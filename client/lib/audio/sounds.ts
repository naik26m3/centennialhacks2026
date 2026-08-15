// Every UI sound is synthesized here — oscillator + lowpass filter + short
// exponential-decay envelope (spec §31-32) — rather than shipped as audio
// files. That sidesteps licensing entirely (spec §66) and adds zero bundle
// weight. All tones share the same construction (playTone) so the set reads
// as one instrument rather than a grab-bag of effects (spec §27).

import { getAudioContext, getUiGain, isAudioInitialized } from "./audio-engine";

export type SoundName = "tap" | "upload" | "step" | "discovery" | "verified" | "complete" | "attention" | "error";

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  gain?: number;
  filterFreq?: number;
  startOffset?: number;
}

function playTone(ctx: AudioContext, dest: AudioNode, opts: ToneOptions): void {
  const { freq, type = "sine", attack = 0.008, decay = 0.14, gain = 0.5, filterFreq = 1800, startOffset = 0 } = opts;
  const now = ctx.currentTime + startOffset;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(gain, now + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

  osc.connect(filter);
  filter.connect(envelope);
  envelope.connect(dest);

  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

type Player = (ctx: AudioContext, dest: AudioNode, scale: number) => void;

const players: Record<SoundName, Player> = {
  // Felt-mallet-like tap: a fundamental with a quiet fifth layered just after.
  tap: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 420, gain: 0.22 * scale, attack: 0.005, decay: 0.12 });
    playTone(ctx, dest, { freq: 630, gain: 0.12 * scale, attack: 0.005, decay: 0.1, startOffset: 0.005 });
  },
  // Soft upward two-note confirmation.
  upload: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 480, gain: 0.2 * scale, decay: 0.14 });
    playTone(ctx, dest, { freq: 640, gain: 0.18 * scale, decay: 0.18, startOffset: 0.09 });
  },
  // Almost subliminal tick, used per-step in progress lists.
  step: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 720, gain: 0.1 * scale, attack: 0.003, decay: 0.06, filterFreq: 2200 });
  },
  // Warm harmonic bloom: root, fifth, then a softer third — "possibility
  // opened," not a victory jingle (spec §33).
  discovery: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 392, gain: 0.22 * scale, decay: 0.7, filterFreq: 2400 });
    playTone(ctx, dest, { freq: 587.33, gain: 0.16 * scale, decay: 0.7, filterFreq: 2400, startOffset: 0.08 });
    playTone(ctx, dest, { freq: 493.88, gain: 0.12 * scale, decay: 0.8, filterFreq: 2200, startOffset: 0.18 });
  },
  // Clean, restrained confirmation for a resolved/verified source.
  verified: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 523.25, gain: 0.2 * scale, decay: 0.25 });
    playTone(ctx, dest, { freq: 783.99, gain: 0.14 * scale, decay: 0.3, startOffset: 0.03 });
  },
  // Soft resolved chord — the "exhale" moment.
  complete: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 392, gain: 0.18 * scale, decay: 0.9 });
    playTone(ctx, dest, { freq: 493.88, gain: 0.14 * scale, decay: 0.9, startOffset: 0.05 });
    playTone(ctx, dest, { freq: 587.33, gain: 0.12 * scale, decay: 1.0, startOffset: 0.1 });
  },
  // Quiet, non-alarming — the interface asking a question, not alerting.
  attention: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 349.23, gain: 0.14 * scale, decay: 0.4, filterFreq: 1200 });
  },
  // Low, muted, short — "needs attention," never "you failed" (spec §34).
  error: (ctx, dest, scale) => {
    playTone(ctx, dest, { freq: 196, gain: 0.16 * scale, decay: 0.3, filterFreq: 800, type: "triangle" });
  },
};

// gainScale lets a caller vary repeated sounds (e.g. AgentTimeline quiets
// later ticks per spec §15/§27) instead of playing one identical sound on
// loop, which reads as mechanical.
export function playSound(name: SoundName, opts: { gainScale?: number } = {}): void {
  if (!isAudioInitialized()) return;
  const ctx = getAudioContext();
  const dest = getUiGain();
  if (!ctx || !dest) return;
  players[name](ctx, dest, opts.gainScale ?? 1);
}
