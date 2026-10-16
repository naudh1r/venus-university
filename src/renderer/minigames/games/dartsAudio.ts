/** Original synthesized effects, with a single volume bus and no downloaded sound assets. */
export class DartsAudio {
  volume: number;
  context: AudioContext | null = null;
  master: GainNode | null = null;
  constructor(volume = 0.55) {
    this.volume = volume;
    this.context = null;
  }
  async unlock() {
    try {
      if (!this.context) {
        this.context = new (globalThis.AudioContext || (globalThis as typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext!)();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.setVolume(this.volume);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* Browsers without audio can still play the game. */
    }
  }
  setVolume(value: number) {
    this.volume = value;
    if (this.master) this.master.gain.value = value * 0.48;
  }
  tone(frequency: number, duration = 0.1, delay = 0, type: OscillatorType = 'sine', amplitude = 0.3) {
    if (!this.context || this.context.state !== 'running') return;
    const c = this.context,
      at = c.currentTime + delay,
      osc = c.createOscillator(),
      gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(amplitude, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(at);
    osc.stop(at + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  noise(duration: number, frequency: number, amplitude: number) {
    if (!this.context || this.context.state !== 'running') return;
    const c = this.context,
      buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    gain.gain.value = amplitude;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start();
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  dispose() {
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
  play(kind: string) {
    if (kind === 'throw') {
      this.noise(0.22, 3200, 0.25);
      return;
    }
    if (kind === 'turn') {
      this.tone(330);
      this.tone(440, 0.15, 0.1);
      return;
    }
    if (kind === 'tick') {
      this.tone(1100, 0.025, 0, 'sine', 0.08);
      return;
    }
    if (kind === 'win') {
      ;
      [392, 494, 587, 784, 988].forEach((n, i) => this.tone(n, 0.5, i * 0.12, 'triangle'));
      return;
    }
    if (kind === 'loss') {
      ;
      [294, 262, 196].forEach((n, i) => this.tone(n, 0.35, i * 0.2, 'triangle'));
      return;
    }
    if (kind === 'draw') {
      ;
      [330, 392, 330].forEach((n, i) => this.tone(n, 0.3, i * 0.17));
      return;
    }
    this.noise(0.12, kind === 'miss' ? 350 : 1800, 0.7);
    this.tone(kind === 'miss' ? 80 : 155, 0.1, 0, 'triangle', 0.55);
    const notes = ({
      double: [523, 659],
      triple: [523, 659, 784],
      outerBull: [659, 880],
      bull: [523, 659, 784, 1047]
    } as Record<string, number[]>)[kind];
    notes?.forEach((n, i) => this.tone(n, 0.24, 0.07 + i * 0.07));
  }
}
