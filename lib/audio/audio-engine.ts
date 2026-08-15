// Single AudioContext for the whole app (spec §45 — never initialize more
// than one). Plain module-level state, no React dependency, so every
// consumer (the audio hook, any component) shares the exact same graph.
//
// Browsers block audio until a user gesture, so nothing here runs until
// initAudio() is called from an actual click/keydown handler.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let uiGain: GainNode | null = null;
let ambientGain: GainNode | null = null;
let muted = false;
let initialized = false;

// Perceived-level targets from spec §28/§29 (speech dominant, ambient ~10-15%
// presence, UI feedback briefly ~15-25%) — first-pass values; tune by ear.
const UI_LEVEL = 0.22;
const AMBIENT_LEVEL = 0.14;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(ctx.destination);

  uiGain = ctx.createGain();
  uiGain.gain.value = UI_LEVEL;
  uiGain.connect(masterGain);

  ambientGain = ctx.createGain();
  ambientGain.gain.value = AMBIENT_LEVEL;
  ambientGain.connect(masterGain);

  return ctx;
}

export function initAudio(): void {
  const c = ensureContext();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {
      // resume can reject if called outside a user gesture — safe to ignore,
      // the next real interaction will retry
    });
  }
  initialized = true;
}

export function isAudioInitialized(): boolean {
  return initialized;
}

export function getAudioContext(): AudioContext | null {
  return ctx;
}

export function getUiGain(): GainNode | null {
  return uiGain;
}

export function getAmbientGain(): GainNode | null {
  return ambientGain;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(next ? 0 : 1, ctx.currentTime + 0.15);
  }
}

export function getMuted(): boolean {
  return muted;
}
