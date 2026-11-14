const SOUND_MUTE_KEY = 'site_sound_muted_v1';

function loadInitialMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SOUND_MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface ToneOptions {
  freq: number;
  endFreq?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
  filterFreq?: number;
}

class SoundFX {
  private ctx: AudioContext | null = null;
  private listeners = new Set<(muted: boolean) => void>();
  private lastClickAt = 0;
  private lastHoverAt = 0;
  public muted = loadInitialMuted();

  init(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    try {
      localStorage.setItem(SOUND_MUTE_KEY, String(nextMuted));
    } catch {
      // Ignore storage errors
    }
    this.listeners.forEach((cb) => cb(nextMuted));
    if (!nextMuted) {
      this.init();
      this.click();
    }
  }

  toggle(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    return next;
  }

  private scheduleTone({
    freq,
    endFreq,
    duration,
    type = 'sine',
    volume = 0.14,
    delay = 0,
    filterFreq,
  }: ToneOptions): void {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;

    const run = () => {
      if (this.muted || ctx.state !== 'running') return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== undefined && endFreq > 0) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      }

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      if (filterFreq !== undefined) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, now);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(run).catch(() => {});
    } else {
      run();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.14,
    delay = 0
  ): void {
    this.scheduleTone({ freq, duration, type, volume, delay });
  }

  hover(): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this.lastHoverAt < 50) return;
    this.lastHoverAt = now;
    this.playTone(620, 0.045, 'sine', 0.03);
  }

  click(): void {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastClickAt < 40) return;
    this.lastClickAt = now;
    this.init();
    this.playTone(480, 0.07, 'triangle', 0.1);
  }

  /**
   * Bright ascending major chime with subtle sparkle (shifts up slightly with streaks).
   */
  correct(streak = 1): void {
    if (this.muted) return;
    this.init();
    const semitoneBoost = Math.min(Math.max(0, streak - 1), 5);
    const pitchMult = Math.pow(2, semitoneBoost / 12);

    this.scheduleTone({
      freq: 523.25 * pitchMult,
      duration: 0.11,
      type: 'triangle',
      volume: 0.15,
      delay: 0,
    });
    this.scheduleTone({
      freq: 659.25 * pitchMult,
      duration: 0.12,
      type: 'triangle',
      volume: 0.15,
      delay: 0.065,
    });
    this.scheduleTone({
      freq: 783.99 * pitchMult,
      duration: 0.18,
      type: 'triangle',
      volume: 0.16,
      delay: 0.13,
    });
    this.scheduleTone({
      freq: 1046.5 * pitchMult,
      duration: 0.3,
      type: 'sine',
      volume: 0.14,
      delay: 0.195,
    });
    this.scheduleTone({
      freq: 1567.98 * pitchMult,
      duration: 0.22,
      type: 'sine',
      volume: 0.055,
      delay: 0.22,
    });
  }

  /**
   * Distinct low descending double-buzz for incorrect or timed-out answers.
   */
  incorrect(): void {
    if (this.muted) return;
    this.init();

    // First descending buzz
    this.scheduleTone({
      freq: 235,
      endFreq: 190,
      duration: 0.16,
      type: 'sawtooth',
      volume: 0.12,
      delay: 0,
      filterFreq: 950,
    });
    this.scheduleTone({
      freq: 118,
      endFreq: 95,
      duration: 0.16,
      type: 'triangle',
      volume: 0.09,
      delay: 0,
    });

    // Second lower drop
    this.scheduleTone({
      freq: 178,
      endFreq: 122,
      duration: 0.28,
      type: 'sawtooth',
      volume: 0.13,
      delay: 0.14,
      filterFreq: 820,
    });
    this.scheduleTone({
      freq: 89,
      endFreq: 65,
      duration: 0.28,
      type: 'triangle',
      volume: 0.1,
      delay: 0.14,
    });
  }

  wrong(): void {
    this.incorrect();
  }

  win(): void {
    if (this.muted) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.1, 0.2, 0.32, 0.46, 0.58];
    notes.forEach((n, i) => {
      this.playTone(n, i === notes.length - 1 ? 0.45 : 0.14, 'triangle', 0.16, times[i]);
    });
  }

  gameOver(): void {
    if (this.muted) return;
    this.init();
    this.playTone(330, 0.22, 'sawtooth', 0.1, 0);
    this.playTone(293.66, 0.22, 'sawtooth', 0.1, 0.2);
    this.playTone(261.63, 0.22, 'sawtooth', 0.1, 0.4);
    this.playTone(196, 0.5, 'sawtooth', 0.11, 0.6);
  }

  tick(): void {
    if (this.muted) return;
    this.init();
    this.playTone(880, 0.04, 'sine', 0.05);
  }
}

export const sfx = new SoundFX();
