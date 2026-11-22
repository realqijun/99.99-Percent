/*
 * Short sound effects for what happens in the game, synthesised as they play
 * with the same building blocks as the music. Each cue is a fraction of a
 * second of chiptune, written around A minor and C major like the music so the
 * two sit together. A voice returns how long it rings, so player.ts can count
 * the voices sounding at once.
 */
import type { Cue } from "./index";
import { frequency as note } from "./score";
import { envelope, filter, hit, noise, osc } from "./synth";

type Ctx = BaseAudioContext;
type Voice = (ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer) => number;

/** Square-wave notes, one after another: the chiptune voice of most cues. */
function run(ctx: Ctx, out: AudioNode, at: number, midis: number[], gap: number, peak: number, decay: number, cutoff = 3200): number {
  const lp = filter(ctx, "lowpass", cutoff);
  lp.connect(out);
  midis.forEach((m, i) => {
    const t = at + i * gap;
    osc(ctx, "square", note(m), t, t + decay + 0.02).connect(hit(ctx, t, peak, decay)).connect(lp);
  });
  return (midis.length - 1) * gap + decay + 0.02;
}

/** A bell: a sine with a quiet octave above it, ringing on. */
function bell(ctx: Ctx, out: AudioNode, at: number, midi: number, peak: number, decay: number): number {
  osc(ctx, "sine", note(midi), at, at + decay + 0.05).connect(hit(ctx, at, peak, decay)).connect(out);
  osc(ctx, "sine", note(midi + 12), at, at + decay / 2 + 0.05).connect(hit(ctx, at, peak * 0.3, decay / 2)).connect(out);
  return decay + 0.05;
}

/** One tone gliding from `from` to `to` Hz. */
function slide(ctx: Ctx, type: OscillatorType, from: number, to: number, at: number, length: number): OscillatorNode {
  const o = osc(ctx, type, from, at, at + length);
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + length * 0.9);
  return o;
}

/** A short burst of hiss through a filter at `hz`, for ticks, clacks and crunches. */
function burst(ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer, type: BiquadFilterType, hz: number, peak: number, decay: number): number {
  noise(ctx, at, at + decay + 0.02, hiss).connect(filter(ctx, type, hz)).connect(hit(ctx, at, peak, decay)).connect(out);
  return decay + 0.02;
}

/** Hiss swept up through a band: cards and pages moving. */
function swish(ctx: Ctx, out: AudioNode, at: number, hiss: AudioBuffer, from: number, to: number, length: number, peak: number): number {
  const band = filter(ctx, "bandpass", from);
  band.Q.value = 1.5;
  band.frequency.setValueAtTime(from, at);
  band.frequency.exponentialRampToValueAtTime(to, at + length);
  noise(ctx, at, at + length, hiss).connect(band).connect(envelope(ctx, at, length, peak, length * 0.3, length * 0.6)).connect(out);
  return length;
}

export const VOICES = {
  /** A button: a quick pitched blip. */
  click: (ctx, out, at) => {
    slide(ctx, "triangle", note(88), note(91), at, 0.1).connect(hit(ctx, at, 0.5, 0.09)).connect(out);
    return 0.1;
  },
  /** A card leaves the hand: a flick of air and a small tick. */
  cardPlay: (ctx, out, at, hiss) => {
    swish(ctx, out, at, hiss, 900, 3200, 0.12, 0.45);
    return Math.max(0.12, run(ctx, out, at + 0.06, [79], 0, 0.14, 0.06));
  },
  /** Serving requests: a laser zap down the scale over a sharp transient. */
  serve: (ctx, out, at, hiss) => {
    const lp = filter(ctx, "lowpass", 3600);
    slide(ctx, "square", note(91), note(67), at, 0.1).connect(hit(ctx, at, 0.38, 0.1)).connect(lp).connect(out);
    burst(ctx, out, at, hiss, "highpass", 5000, 0.25, 0.03);
    return 0.12;
  },
  /** Capacity soaks up a hit: a dull knock and a metallic ping. */
  hit: (ctx, out, at, hiss) => {
    slide(ctx, "triangle", 220, 140, at, 0.12).connect(hit(ctx, at, 0.7, 0.11)).connect(out);
    burst(ctx, out, at, hiss, "bandpass", 2500, 0.3, 0.04);
    run(ctx, out, at + 0.01, [84], 0, 0.1, 0.1, 4000);
    return 0.14;
  },
  /** Error Budget burns: a low, grinding drop through a crunch. */
  budgetLoss: (ctx, out, at, hiss) => {
    const lp = filter(ctx, "lowpass", 900);
    lp.connect(out);
    slide(ctx, "square", note(45), note(33), at, 0.26).connect(envelope(ctx, at, 0.26, 0.2, 0.005, 0.12)).connect(lp);
    slide(ctx, "square", note(46), note(34), at, 0.26).connect(envelope(ctx, at, 0.26, 0.12, 0.005, 0.12)).connect(lp);
    burst(ctx, out, at, hiss, "lowpass", 1400, 0.3, 0.16);
    return 0.26;
  },
  /** Capacity goes up: three quick rising notes. */
  capacity: (ctx, out, at) => run(ctx, out, at, [69, 76, 81], 0.045, 0.22, 0.1, 2800),
  /** Error Budget comes back: a soft triangle arpeggio up to a bell. */
  recover: (ctx, out, at) => {
    [72, 76, 79, 84].forEach((m, i) => {
      const t = at + i * 0.06;
      osc(ctx, "triangle", note(m), t, t + 0.26).connect(hit(ctx, t, 0.3, 0.24)).connect(out);
    });
    return 0.2 + bell(ctx, out, at + 0.2, 88, 0.05, 0.4);
  },
  /** A status takes hold: a warbling slide down a fourth. */
  status: (ctx, out, at) => {
    const o = slide(ctx, "triangle", note(81), note(76), at, 0.22);
    const wobble = osc(ctx, "sine", 14, at, at + 0.22);
    const depth = ctx.createGain();
    depth.gain.value = 40;
    wobble.connect(depth).connect(o.detune);
    o.connect(envelope(ctx, at, 0.22, 0.2, 0.01, 0.1)).connect(out);
    return 0.22;
  },
  /** Infrastructure goes in: a heavy thump, a latch, and two notes as it comes online. */
  infra: (ctx, out, at, hiss) => {
    slide(ctx, "sine", 120, 50, at, 0.2).connect(hit(ctx, at, 0.7, 0.18)).connect(out);
    burst(ctx, out, at, hiss, "lowpass", 900, 0.25, 0.08);
    burst(ctx, out, at + 0.07, hiss, "bandpass", 2000, 0.14, 0.03);
    return 0.1 + run(ctx, out, at + 0.1, [72, 79], 0.06, 0.18, 0.08);
  },
  /** A node fails: two alarm beeps over a machine powering down. */
  nodeFailure: (ctx, out, at, hiss) => {
    const lp = filter(ctx, "lowpass", 1500);
    lp.connect(out);
    slide(ctx, "sawtooth", 440, 90, at, 0.42).connect(envelope(ctx, at, 0.42, 0.12, 0.01, 0.2)).connect(lp);
    for (const t of [at, at + 0.14]) osc(ctx, "square", note(82), t, t + 0.1).connect(envelope(ctx, t, 0.1, 0.1, 0.005, 0.03)).connect(lp);
    burst(ctx, out, at + 0.05, hiss, "bandpass", 3000, 0.1, 0.06);
    return 0.42;
  },
  /** An enemy is resolved: a puff of air and a bright rising call. */
  enemyResolved: (ctx, out, at, hiss) => {
    burst(ctx, out, at, hiss, "bandpass", 1200, 0.4, 0.12);
    return run(ctx, out, at + 0.02, [76, 81, 88], 0.05, 0.2, 0.14);
  },
  /** A card is drawn: the tiniest flick. */
  draw: (ctx, out, at, hiss) => {
    burst(ctx, out, at, hiss, "highpass", 4000, 0.25, 0.03);
    osc(ctx, "triangle", note(93), at, at + 0.04).connect(hit(ctx, at, 0.1, 0.03)).connect(out);
    return 0.05;
  },
  /** The discard pile becomes the draw pile: a riffle of clicks. */
  shuffle: (ctx, out, at, hiss) => {
    for (let i = 0; i < 7; i++) burst(ctx, out, at + i * 0.035, hiss, "bandpass", 2600 + i * 200, 0.22, 0.025);
    return 7 * 0.035;
  },
  /** Cash: a coin. */
  cash: (ctx, out, at) => run(ctx, out, at, [83, 88], 0.06, 0.2, 0.24, 4000),
  /** A relic: a quick arpeggio with a sparkle on top. */
  relic: (ctx, out, at) => {
    run(ctx, out, at, [72, 76, 79, 84, 88], 0.055, 0.16, 0.22);
    return 0.28 + bell(ctx, out, at + 0.28, 96, 0.06, 0.5);
  },
  /** A runbook: pages turning, then two bells. */
  runbook: (ctx, out, at, hiss) => {
    swish(ctx, out, at, hiss, 500, 3000, 0.25, 0.3);
    bell(ctx, out, at + 0.12, 79, 0.12, 0.4);
    return 0.2 + bell(ctx, out, at + 0.2, 84, 0.12, 0.5);
  },
  /** A combat is won: a run up to a bell over a soft major chord. */
  combatWon: (ctx, out, at) => {
    run(ctx, out, at, [72, 76, 79, 84], 0.07, 0.12, 0.12);
    for (const m of [60, 64, 67]) osc(ctx, "triangle", note(m), at + 0.21, at + 0.9).connect(envelope(ctx, at + 0.21, 0.69, 0.05, 0.05, 0.4)).connect(out);
    return 0.28 + bell(ctx, out, at + 0.28, 88, 0.15, 0.6);
  },
  /** An act is complete: a fanfare. */
  actComplete: (ctx, out, at) => {
    run(ctx, out, at, [72, 76, 79], 0.1, 0.12, 0.12);
    for (const m of [84, 88, 91]) {
      osc(ctx, "square", note(m), at + 0.3, at + 1.1).connect(filter(ctx, "lowpass", 3000)).connect(envelope(ctx, at + 0.3, 0.8, 0.06, 0.02, 0.45)).connect(out);
      osc(ctx, "triangle", note(m - 12), at + 0.3, at + 1.1).connect(envelope(ctx, at + 0.3, 0.8, 0.08, 0.02, 0.45)).connect(out);
    }
    return 1.1;
  },
  /** The IPO: a longer fanfare, a held chord and a shower of bells. */
  runWon: (ctx, out, at) => {
    run(ctx, out, at, [67, 72, 76, 79], 0.09, 0.12, 0.12);
    for (const m of [84, 88, 91]) {
      osc(ctx, "square", note(m), at + 0.36, at + 1.8).connect(filter(ctx, "lowpass", 3000)).connect(envelope(ctx, at + 0.36, 1.44, 0.06, 0.02, 0.8)).connect(out);
      osc(ctx, "triangle", note(m - 24), at + 0.36, at + 1.8).connect(envelope(ctx, at + 0.36, 1.44, 0.08, 0.02, 0.8)).connect(out);
    }
    [96, 100, 103, 108].forEach((m, i) => bell(ctx, out, at + 0.5 + i * 0.12, m, 0.05, 0.6));
    return 1.8;
  },
  /** The SLA is breached: a slow sad slide down, wobbling at the end. */
  runLost: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 1200);
    lp.connect(out);
    [67, 66, 65].forEach((m, i) => {
      const t = at + i * 0.26;
      osc(ctx, "square", note(m), t, t + 0.24).connect(envelope(ctx, t, 0.24, 0.13, 0.02, 0.08)).connect(lp);
    });
    const t = at + 0.78;
    const last = osc(ctx, "square", note(64), t, t + 0.7);
    const wobble = osc(ctx, "sine", 5, t, t + 0.7);
    const depth = ctx.createGain();
    depth.gain.value = 30;
    wobble.connect(depth).connect(last.detune);
    last.connect(envelope(ctx, t, 0.7, 0.13, 0.02, 0.3)).connect(lp);
    return 1.48;
  },
  /** Not allowed: a low, soft buzz. */
  error: (ctx, out, at) => {
    const lp = filter(ctx, "lowpass", 700);
    lp.connect(envelope(ctx, at, 0.16, 0.09, 0.005, 0.05)).connect(out);
    osc(ctx, "square", 98, at, at + 0.17).connect(lp);
    osc(ctx, "square", 104, at, at + 0.17).connect(lp);
    return 0.17;
  },
} satisfies Record<Cue, Voice>;

export const CUES = Object.keys(VOICES) as Cue[];

/**
 * The end-of-fight stingers, by size. Winning a run also wins its act and its
 * last combat: the bigger stinger cuts the smaller one short, and a smaller one
 * is dropped while a bigger one plays.
 */
export const STINGERS: Partial<Record<Cue, number>> = { combatWon: 1, actComplete: 2, runWon: 3, runLost: 3 };
