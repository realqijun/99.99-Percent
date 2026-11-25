/*
 * Turns the scores in score.ts into sound. Each playing track is a lane: a
 * gain of its own, fed note by note a little ahead of time by player.ts's
 * lookahead timer, so the loop never stutters and a change of track can fade
 * one lane out while the next fades in.
 */
import type { Track } from "./index";
import { compose, frequency, type Note } from "./score";
import { envelope, filter, hit, noise, osc } from "./synth";

type Ctx = BaseAudioContext;

/** A note this late is skipped rather than played out of time, as after the timer stalled. */
const LATE = 0.05;

/** One note through its voice's synth, into out. */
function play(ctx: Ctx, out: AudioNode, hiss: AudioBuffer, n: Note, at: number, length: number): void {
  const end = at + length;
  const hz = frequency(n.midi);
  switch (n.voice) {
    case "pad": {
      const g = envelope(ctx, at, length, n.gain * 0.09, Math.min(0.8, length / 3), Math.min(0.9, length / 3));
      const lp = filter(ctx, "lowpass", 1300);
      osc(ctx, "triangle", hz, at, end, -7).connect(lp);
      osc(ctx, "triangle", hz, at, end, 7).connect(lp);
      lp.connect(g).connect(out);
      break;
    }
    case "pluck": {
      const g = hit(ctx, at, n.gain * 0.12, 0.32);
      osc(ctx, "square", hz, at, at + 0.35).connect(filter(ctx, "lowpass", 2200)).connect(g).connect(out);
      break;
    }
    case "bass": {
      const g = envelope(ctx, at, length, n.gain * 0.3, 0.01, 0.06);
      osc(ctx, "triangle", hz, at, end).connect(g);
      osc(ctx, "sine", hz / 2, at, end).connect(g);
      g.connect(out);
      break;
    }
    case "lead": {
      // A pulse wave, rounded off, with a slight chorus from a detuned twin.
      const lp = filter(ctx, "lowpass", 2600);
      osc(ctx, "square", hz, at, end).connect(lp);
      osc(ctx, "square", hz, at, end, 9).connect(lp);
      lp.connect(envelope(ctx, at, length, n.gain * 0.05, 0.01, Math.min(0.12, length / 2))).connect(out);
      break;
    }
    case "bell": {
      osc(ctx, "sine", hz, at, end + 0.6).connect(hit(ctx, at, n.gain * 0.16, length + 0.5)).connect(out);
      osc(ctx, "sine", hz * 2, at, at + 0.4).connect(hit(ctx, at, n.gain * 0.04, 0.35)).connect(out);
      break;
    }
    case "kick": {
      const o = osc(ctx, "sine", 140, at, at + 0.35);
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      o.connect(hit(ctx, at, n.gain * 0.75, 0.32)).connect(out);
      break;
    }
    case "snare": {
      noise(ctx, at, at + 0.2, hiss).connect(filter(ctx, "bandpass", 1800)).connect(hit(ctx, at, n.gain * 0.45, 0.18)).connect(out);
      osc(ctx, "triangle", 185, at, at + 0.1).connect(hit(ctx, at, n.gain * 0.2, 0.08)).connect(out);
      break;
    }
    case "hat": {
      noise(ctx, at, at + 0.06, hiss).connect(filter(ctx, "highpass", 7000)).connect(hit(ctx, at, n.gain * 0.25, 0.05)).connect(out);
      break;
    }
    case "alarm": {
      const o = osc(ctx, "square", hz, at, end);
      const wobble = osc(ctx, "sine", 6, at, end);
      const depth = ctx.createGain();
      depth.gain.value = 18;
      wobble.connect(depth).connect(o.detune);
      o.connect(filter(ctx, "lowpass", 2600)).connect(envelope(ctx, at, length, n.gain * 0.07, 0.02, 0.08)).connect(out);
      break;
    }
  }
}

export interface Lane {
  readonly track: Track;
  readonly gain: GainNode;
  /** No notes are scheduled from here on, while the lane fades out. Infinity while it is the current track. */
  until: number;
  /** Schedule the notes that start before `horizon`. While not `audible` they pass without making nodes. */
  fill(horizon: number, audible: boolean): void;
}

/** Start `track` looping at `at`, fading in over `fadeIn` seconds. */
export function createLane(ctx: Ctx, into: AudioNode, hiss: AudioBuffer, track: Track, at: number, fadeIn: number): Lane {
  const score = compose(track);
  const beat = 60 / score.bpm;
  const loop = score.beats * beat;
  const notes = [...score.notes].sort((a, b) => a.beat - b.beat);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeIn);
  gain.connect(into);
  let index = 0;
  let round = 0;
  const lane: Lane = {
    track,
    gain,
    until: Infinity,
    fill(horizon, audible) {
      const end = Math.min(horizon, lane.until);
      for (;;) {
        const n = notes[index];
        const t = at + round * loop + n.beat * beat;
        if (t >= end) return;
        if (audible && t >= ctx.currentTime - LATE) play(ctx, gain, hiss, n, t, n.beats * beat);
        if (++index === notes.length) {
          index = 0;
          round++;
        }
      }
    },
  };
  return lane;
}
