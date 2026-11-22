/*
 * The one audio context behind the music and the effects. Browsers only let a
 * page make sound after the player has pressed something, so the context is
 * created on the first press; anything asked for before then is dropped. Music
 * and effects each have a gain, and whenever nothing can be heard, or the tab
 * is hidden, the context is suspended so it costs nothing. Where the Web Audio
 * API is missing, as in tests, everything is silent and nothing fails.
 */
import type { Cue, Track, Volumes } from "./index";
import { createLane, type Lane } from "./music";
import { STINGERS, VOICES } from "./sfx";
import { hissBuffer, loudness, onUserGesture, ramp, realtimeAudio } from "./synth";

export interface Player {
  playCue(cue: Cue): void;
  setTrack(track: Track | null): void;
  setVolumes(volumes: Volumes): void;
  /** Stop for good and release the audio device. */
  dispose(): void;
}

/** Loudness at full volume. Music sits under the game, not over it. */
const MUSIC_PEAK = 0.4;
const SFX_PEAK = 0.9;
/** Seconds to follow a volume slider: quick, without clicks. */
const SLIDE = 0.08;
/** Seconds to fade the music in from silence, between tracks, and out to silence. */
const FADE_IN = 0.8;
const CROSSFADE = 1.4;
const FADE_OUT = 1;
/** Once nothing can be heard, the context sleeps after this long: past any fade, and a quick mute and unmute stays awake. */
export const SLEEP_MS = 2000;
/** The lookahead timer: how often it runs, and how far ahead of the audio clock it schedules notes. */
export const TICK_MS = 50;
export const AHEAD = 0.3;
/** The same cue at most once in this long, and at most this many cues ringing at once. */
export const GAP_MS = 60;
export const MAX_VOICES = 8;
/** A cue asked for while the context wakes still plays if it wakes within this long. */
const FRESH_MS = 250;

const SILENT: Player = { playCue() {}, setTrack() {}, setVolumes() {}, dispose() {} };

export function createPlayer(now: () => number = () => performance.now()): Player {
  const Available = realtimeAudio();
  if (!Available) return SILENT;
  const AudioCtor: typeof AudioContext = Available;

  let ctx: AudioContext | null = null;
  let sfxBus: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let musicIn: AudioNode | null = null;
  let hiss: AudioBuffer | null = null;
  let volumes: Volumes = { music: 0.7, sfx: 0.8, muted: false };
  let track: Track | null = null;
  let lanes: Lane[] = [];
  let ticker = 0;
  let sleeper = 0;
  let waking: Promise<void> | null = null;
  let disposed = false;
  let warned = false;
  const last = new Map<Cue, number>();
  /** When each ringing cue ends, on the audio clock. */
  let ringing: number[] = [];
  let stinger: { rank: number; gain: GainNode; until: number } | null = null;

  const hidden = () => document.visibilityState === "hidden";
  const musicLevel = () => (volumes.muted ? 0 : loudness(volumes.music, MUSIC_PEAK));
  const sfxLevel = () => (volumes.muted ? 0 : loudness(volumes.sfx, SFX_PEAK));
  const audible = () => sfxLevel() > 0 || (musicLevel() > 0 && track !== null);

  function start(): AudioContext {
    if (ctx) return ctx;
    const c = new AudioCtor();
    // A gentle limiter, so cues landing on the music never clip.
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    limiter.connect(c.destination);
    sfxBus = c.createGain();
    sfxBus.gain.value = sfxLevel();
    sfxBus.connect(limiter);
    musicBus = c.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(limiter);
    // The music's own glue, ahead of its volume, as the old rendered loops had.
    musicIn = c.createDynamicsCompressor();
    musicIn.connect(musicBus);
    hiss = hissBuffer(c);
    ctx = c;
    if (track) lanes.push(createLane(c, musicIn, hiss, track, c.currentTime + 0.05, FADE_IN));
    return c;
  }

  function resume(c: AudioContext): Promise<void> {
    const p = c.resume().catch(() => {});
    waking = p;
    void p.then(() => {
      if (waking === p) waking = null;
    });
    return p;
  }

  // The first press creates the audio and wakes it; once it runs, stop listening.
  const stopListening = onUserGesture(() => {
    if (disposed) return;
    const c = start();
    void resume(c).then(() => {
      if (c.state === "running") stopListening();
    });
    refresh(FADE_IN);
  });

  function tick(): void {
    const c = ctx;
    if (!c || !musicIn) return;
    const t = c.currentTime;
    const on = musicLevel() > 0;
    lanes = lanes.filter((lane) => {
      if (lane.until + 0.1 < t) {
        lane.gain.disconnect();
        return false;
      }
      lane.fill(t + AHEAD, on);
      return true;
    });
    if (!lanes.length) stopTicking();
  }

  function stopTicking(): void {
    window.clearInterval(ticker);
    ticker = 0;
  }

  function sleep(c: AudioContext): void {
    stopTicking();
    c.suspend().catch(() => {});
  }

  /** Bring the gains to what the settings ask for, then wake the audio or let it sleep. */
  function refresh(musicSeconds = SLIDE): void {
    const c = ctx;
    if (!c || !sfxBus || !musicBus) return;
    ramp(c, musicBus.gain, musicLevel(), musicSeconds);
    ramp(c, sfxBus.gain, sfxLevel(), SLIDE);
    window.clearTimeout(sleeper);
    if (hidden()) return sleep(c);
    if (!audible()) {
      sleeper = window.setTimeout(() => sleep(c), SLEEP_MS);
      if (c.state !== "running") return;
    // Not running covers Safari's "interrupted", after a call or another app took the audio.
    } else if (c.state !== "running" && !waking) void resume(c);
    if (lanes.length && !ticker) ticker = window.setInterval(tick, TICK_MS);
    tick();
  }

  const onVisibility = () => refresh();
  document.addEventListener("visibilitychange", onVisibility);

  function sound(c: AudioContext, cue: Cue): void {
    if (!sfxBus || !hiss) return;
    const at = c.currentTime + 0.005;
    ringing = ringing.filter((end) => end > c.currentTime);
    if (ringing.length >= MAX_VOICES) return;
    const rank = STINGERS[cue];
    let out: GainNode = sfxBus;
    if (rank) {
      if (stinger && stinger.until > at) {
        if (rank <= stinger.rank) return;
        ramp(c, stinger.gain.gain, 0, 0.06);
      }
      out = c.createGain();
      out.connect(sfxBus);
    }
    try {
      const end = at + VOICES[cue](c, out, at, hiss);
      ringing.push(end);
      if (rank) stinger = { rank, gain: out, until: end };
    } catch (error) {
      if (!warned) console.warn("A sound effect could not be played; the game carries on without it.", error);
      warned = true;
    }
  }

  return {
    playCue(cue) {
      const c = ctx;
      if (disposed || !c || sfxLevel() <= 0 || hidden()) return;
      const t = now();
      if (t - (last.get(cue) ?? -Infinity) < GAP_MS) return;
      last.set(cue, t);
      if (c.state === "running") sound(c, cue);
      // Anything scheduled on a sleeping context would start all at once when it wakes: play this only if it wakes promptly.
      else if (waking)
        void waking.then(() => {
          if (ctx === c && c.state === "running" && sfxLevel() > 0 && now() - t < FRESH_MS) sound(c, cue);
        });
    },
    setTrack(next) {
      if (disposed || next === track) return;
      track = next;
      const c = ctx;
      if (!c || !musicIn || !hiss) return;
      const fade = next ? CROSSFADE : FADE_OUT;
      const playing = lanes.some((lane) => lane.until === Infinity);
      for (const lane of lanes) {
        if (lane.until !== Infinity) continue;
        lane.until = c.currentTime + fade;
        ramp(c, lane.gain.gain, 0, fade);
      }
      if (next) lanes.push(createLane(c, musicIn, hiss, next, c.currentTime + 0.05, playing ? CROSSFADE : FADE_IN));
      refresh();
    },
    setVolumes(next) {
      if (disposed) return;
      const wasSilent = musicLevel() === 0;
      volumes = { music: next.music, sfx: next.sfx, muted: next.muted };
      refresh(wasSilent ? FADE_IN : SLIDE);
    },
    dispose() {
      disposed = true;
      window.clearTimeout(sleeper);
      stopTicking();
      stopListening();
      document.removeEventListener("visibilitychange", onVisibility);
      ctx?.close().catch(() => {});
      ctx = null;
      lanes = [];
    },
  };
}
