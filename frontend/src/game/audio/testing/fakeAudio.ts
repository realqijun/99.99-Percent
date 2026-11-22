/*
 * Just enough of the Web Audio API to run the audio in jsdom: nodes connect
 * and schedule but make no sound. Parameters remember the last value they were
 * set or ramped to, nodes what they feed, and contexts what they build.
 */

class FakeParam {
  value: number;
  constructor(value = 0) {
    this.value = value;
  }
  /** Every value a ramp has headed for, in order. */
  ramps: number[] = [];
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.ramps.push(v);
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.ramps.push(v);
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

export class FakeNode {
  outputs: unknown[] = [];
  disconnected = false;
  connect<T>(next: T): T {
    this.outputs.push(next);
    return next;
  }
  disconnect() {
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

class FakeScheduled extends FakeNode {
  /** When start() asked it to begin, on the audio clock. */
  at = -1;
  start(at = 0) {
    this.at = at;
  }
  stop() {}
}

class FakeOscillator extends FakeScheduled {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
}

class FakeSource extends FakeScheduled {
  buffer: FakeBuffer | null = null;
  loop = false;
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeBuffer {
  readonly length: number;
  readonly sampleRate: number;
  private data: Float32Array;
  constructor(_channels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData() {
    return this.data;
  }
}

export class FakeAudioContext {
  /** Every context made since the last reset. */
  static made: FakeAudioContext[] = [];
  /** What `resume()` does; tests can make it hang or fail. */
  static resume: (ctx: FakeAudioContext) => Promise<void> = (ctx) => {
    ctx.state = "running";
    return Promise.resolve();
  };
  static reset() {
    FakeAudioContext.made = [];
    FakeAudioContext.resume = (ctx) => {
      ctx.state = "running";
      return Promise.resolve();
    };
  }

  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  sources: FakeSource[] = [];
  compressors: FakeCompressor[] = [];
  resumes = 0;

  constructor() {
    FakeAudioContext.made.push(this);
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createDynamicsCompressor() {
    const c = new FakeCompressor();
    this.compressors.push(c);
    return c;
  }
  createBuffer(channels: number, length: number, rate: number) {
    return new FakeBuffer(channels, length, rate);
  }
  resume() {
    this.resumes++;
    return FakeAudioContext.resume(this);
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
  /** Sounds started on this context: oscillators and buffer sources. */
  get voices() {
    return this.oscillators.length + this.sources.length;
  }
}
