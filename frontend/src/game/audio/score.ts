/*
 * The game's background music, written out as notes. Four short loops around
 * A minor and C major, so the effects in sfx.ts sit in the same key: a hopeful
 * theme for the title, an easy groove for the map, a driving pulse for combat
 * and, for the bosses, a faster, darker one with an alarm that will not stop.
 * Kept free of the Web Audio API so the music can be checked in tests;
 * music.ts turns a score into sound.
 */
import type { Track } from "./index";

export const TRACKS: Track[] = ["title", "map", "combat", "boss"];

export type Voice = "pad" | "pluck" | "bass" | "lead" | "bell" | "kick" | "snare" | "hat" | "alarm";
/** Voices with a pitch; the rest are drums. */
export const PITCHED: Voice[] = ["pad", "pluck", "bass", "lead", "bell", "alarm"];

export interface Note {
  /** When the note starts and how long it lasts, in beats from the start of the loop. */
  beat: number;
  beats: number;
  /** MIDI note number; ignored for drums. */
  midi: number;
  voice: Voice;
  /** Loudness from 0 to 1 before mixing. */
  gain: number;
}

export interface Score {
  track: Track;
  bpm: number;
  /** Length of the loop in beats. */
  beats: number;
  notes: Note[];
}

/** Four beats to a bar. */
const BAR = 4;

export function secondsOf(score: Score): number {
  return (score.beats * 60) / score.bpm;
}

export function frequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const note = (beat: number, beats: number, midi: number, voice: Voice, gain: number): Note => ({ beat, beats, midi, voice, gain });

/** A chord: the bass note and the tones above it. */
interface Chord {
  root: number;
  tones: number[];
}

/** [beat, beats, midi] lines, moved to start at `at`. */
function line(notes: Note[], at: number, parts: number[][], voice: Voice, gain: number): void {
  for (const [beat, beats, midi] of parts) notes.push(note(at + beat, beats, midi, voice, gain));
}

/** The title: Am, F, C, G at 100 beats a minute, a square-wave tune over a soft arpeggio. */
function title(): Score {
  const chords: Chord[] = [
    { root: 45, tones: [57, 60, 64] },
    { root: 41, tones: [57, 60, 65] },
    { root: 48, tones: [55, 60, 64] },
    { root: 43, tones: [55, 59, 62] },
  ];
  const span = 2 * BAR;
  const notes: Note[] = [];
  chords.forEach(({ root, tones }, c) => {
    const at = c * span;
    for (const midi of tones) notes.push(note(at, span, midi, "pad", 0.4));
    for (let bar = 0; bar < 2; bar++)
      line(notes, at + bar * BAR, [[0, 1, root], [1.5, 0.5, root], [2, 1, root + 12], [3, 1, root]], "bass", 0.7);
    [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1].forEach((i, k) => notes.push(note(at + k * 0.5, 0.5, tones[i] + 12, "pluck", k % 4 === 0 ? 0.4 : 0.28)));
  });
  line(notes, 0, [
    [0, 1.5, 76], [1.5, 0.5, 74], [2, 1, 72], [3, 1, 74], [4, 2, 76], [6, 1, 79], [7, 1, 76],
    [8, 1.5, 77], [9.5, 0.5, 76], [10, 1, 74], [11, 1, 72], [12, 3, 72], [15, 1, 69],
    [16, 1.5, 76], [17.5, 0.5, 74], [18, 1, 72], [19, 1, 74], [20, 2, 76], [22, 1, 79], [23, 1, 81],
    [24, 2, 79], [26, 1, 77], [27, 1, 76], [28, 3, 74], [31, 1, 71],
  ], "lead", 0.6);
  for (let bar = 0; bar < 8; bar++) {
    const at = bar * BAR;
    notes.push(note(at, 0.5, 0, "kick", 0.8), note(at + 2.5, 0.5, 0, "kick", 0.6));
    notes.push(note(at + 1, 0.5, 0, "snare", 0.35), note(at + 3, 0.5, 0, "snare", 0.35));
    for (let e = 0; e < 8; e++) notes.push(note(at + e * 0.5, 0.25, 0, "hat", e % 2 ? 0.3 : 0.45));
  }
  return { track: "title", bpm: 100, beats: chords.length * span, notes };
}

/** The map: Fmaj7, G6, Em7, Am7 at an easy 88, swung hats and a bell picking out a tune. */
function map(): Score {
  const chords: Chord[] = [
    { root: 41, tones: [53, 57, 60, 64] },
    { root: 43, tones: [55, 59, 62, 64] },
    { root: 40, tones: [52, 55, 59, 62] },
    { root: 45, tones: [57, 60, 64, 67] },
  ];
  const span = 2 * BAR;
  // Chord tones for the arpeggio, eighth by eighth; -1 is a rest.
  const arpeggio = [0, 2, 1, 3, 2, -1, 1, 2, 3, 2, 1, -1, 0, 1, 2, -1];
  const notes: Note[] = [];
  chords.forEach(({ root, tones }, c) => {
    const at = c * span;
    for (const midi of tones) notes.push(note(at, span, midi, "pad", 0.45));
    line(notes, at, [[0, 1.5, root], [3.5, 0.5, root], [4, 1.5, root], [6, 1.5, root + 7]], "bass", 0.75);
    arpeggio.forEach((i, k) => {
      if (i >= 0) notes.push(note(at + k * 0.5, 0.5, tones[i] + 12, "pluck", k % 4 === 0 ? 0.45 : 0.32));
    });
  });
  line(notes, 0, [
    [0, 2, 81], [2, 1, 79], [3, 5, 76],
    [8, 2, 83], [10, 1, 81], [11, 5, 79],
    [16, 2, 79], [18, 1, 76], [19, 5, 74],
    [24, 2, 76], [26, 1, 79], [27, 3, 81], [30, 2, 84],
  ], "bell", 0.5);
  for (let bar = 0; bar < 8; bar++) {
    const at = bar * BAR;
    notes.push(note(at, 0.5, 0, "kick", 0.8), note(at + 2.5, 0.5, 0, "kick", 0.6));
    notes.push(note(at + 1, 0.5, 0, "snare", 0.35), note(at + 3, 0.5, 0, "snare", 0.35));
    // Swung hats: the off-beat eighths land a little late.
    for (let e = 0; e < 8; e++) notes.push(note(at + e * 0.5 + (e % 2 ? 0.08 : 0), 0.25, 0, "hat", e % 2 ? 0.3 : 0.5));
  }
  return { track: "map", bpm: 88, beats: chords.length * span, notes };
}

/** Combat: Am, G, F, E at 128, a pumping octave bass, chord stabs and a riff answering every other bar. */
function combat(): Score {
  const chords: Chord[] = [
    { root: 45, tones: [57, 60, 64] },
    { root: 43, tones: [55, 59, 62] },
    { root: 41, tones: [53, 57, 60] },
    { root: 40, tones: [52, 56, 59] },
  ];
  const span = 2 * BAR;
  const stabs = [0, 0.75, 1.5, 2.5, 3];
  // The riff, as [beat, beats, chord tone] an octave up.
  const riff = [[0, 0.5, 2], [0.5, 0.5, 1], [1, 0.5, 0], [1.5, 0.5, 1], [2, 1, 2], [3, 0.5, 1], [3.5, 0.5, 2]];
  const notes: Note[] = [];
  chords.forEach(({ root, tones }, c) => {
    const at = c * span;
    for (const midi of tones) notes.push(note(at, span, midi - 12, "pad", 0.3));
    for (let e = 0; e < span * 2; e++) notes.push(note(at + e * 0.5, 0.4, e % 2 ? root + 12 : root, "bass", e % 2 ? 0.55 : 0.8));
    for (const s of stabs) for (const midi of tones) notes.push(note(at + s, 0.25, midi + 12, "pluck", 0.28));
    for (const [beat, beats, i] of riff) notes.push(note(at + BAR + beat, beats, tones[i] + 12, "lead", 0.55));
  });
  for (let bar = 0; bar < 8; bar++) {
    const at = bar * BAR;
    notes.push(note(at, 0.5, 0, "kick", 0.9), note(at + 1.5, 0.5, 0, "kick", 0.6), note(at + 2, 0.5, 0, "kick", 0.85));
    notes.push(note(at + 1, 0.5, 0, "snare", 0.5), note(at + 3, 0.5, 0, "snare", 0.5));
    for (let e = 0; e < 8; e++) notes.push(note(at + e * 0.5, 0.2, 0, "hat", e % 2 ? 0.3 : 0.45));
    notes.push(note(at + 3.75, 0.2, 0, "hat", 0.3));
  }
  return { track: "combat", bpm: 128, beats: chords.length * span, notes };
}

/** The boss: Am, Bb, Am, E, then Am, Bb, F, E at 148. Four on the floor, sixteenth bass, an alarm, then a chromatic riff. */
function boss(): Score {
  const chords: Chord[] = [
    { root: 45, tones: [57, 60, 64] },
    { root: 46, tones: [58, 62, 65] },
    { root: 45, tones: [57, 60, 64] },
    { root: 40, tones: [56, 59, 64] },
    { root: 45, tones: [57, 60, 64] },
    { root: 46, tones: [58, 62, 65] },
    { root: 41, tones: [57, 60, 65] },
    { root: 40, tones: [56, 59, 64] },
  ];
  const riffs = [
    [[0, 0.5, 81], [0.5, 0.5, 80], [1, 0.5, 81], [1.5, 0.5, 84], [2, 1, 81], [3, 1, 76]],
    [[0, 0.5, 82], [0.5, 0.5, 81], [1, 0.5, 82], [1.5, 0.5, 86], [2, 1, 82], [3, 1, 77]],
    [[0, 0.5, 81], [0.5, 0.5, 77], [1, 0.5, 72], [1.5, 0.5, 77], [2, 1, 81], [3, 1, 84]],
    [[0, 0.5, 83], [0.5, 0.5, 80], [1, 0.5, 76], [1.5, 0.5, 80], [2, 2, 83]],
  ];
  const notes: Note[] = [];
  chords.forEach(({ root, tones }, bar) => {
    const at = bar * BAR;
    for (const midi of tones) notes.push(note(at, BAR, midi - 12, "pad", 0.3));
    for (let s = 0; s < 16; s++) notes.push(note(at + s * 0.25, 0.2, s % 4 === 2 ? root + 12 : root, "bass", s % 4 === 0 ? 0.85 : 0.5));
    for (const s of [0.5, 1.5, 2.5, 3.5]) for (const midi of tones) notes.push(note(at + s, 0.25, midi + 12, "pluck", 0.26));
    // First half: the alarm wails a semitone over every other bar. Second half: the riff.
    if (bar < 4 && bar % 2 === 1) line(notes, at, [[0, 1, 81], [1, 1, 82], [2, 1, 81], [3, 1, 82]], "alarm", 0.5);
    if (bar === 2) line(notes, at, riffs[0], "lead", 0.5);
    if (bar >= 4) line(notes, at, riffs[bar - 4], "lead", 0.6);
    for (let b = 0; b < BAR; b++) notes.push(note(at + b, 0.5, 0, "kick", 0.95));
    for (let s = 0; s < 16; s++) notes.push(note(at + s * 0.25, 0.15, 0, "hat", s % 2 ? 0.25 : 0.4));
    // A snare fill rolls into the top of the loop.
    const snares = bar === 7 ? [1, 3, 3.25, 3.5, 3.75] : [1, 3];
    for (const s of snares) notes.push(note(at + s, 0.5, 0, "snare", s % 1 ? 0.4 : 0.6));
  });
  return { track: "boss", bpm: 148, beats: chords.length * BAR, notes };
}

export function compose(track: Track): Score {
  switch (track) {
    case "title":
      return title();
    case "map":
      return map();
    case "combat":
      return combat();
    case "boss":
      return boss();
  }
}
