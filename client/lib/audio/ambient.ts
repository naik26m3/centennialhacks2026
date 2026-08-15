// A short welcome bloom, synthesized in-browser. It deliberately ends after
// a few seconds instead of running as an ambient bed. The rising major chord
// is warm and optimistic, with no noise layer or low drone that can buzz.

import { getAmbientGain, getAudioContext, isAudioInitialized } from "./audio-engine";

interface AmbientNodes {
  stop: () => void;
}

let started = false;
let active: AmbientNodes | null = null;

export function startAmbient(): void {
  if (started || !isAudioInitialized()) return;
  const ctx = getAudioContext();
  const dest = getAmbientGain();
  if (!ctx || !dest) return;
  started = true;

  const now = ctx.currentTime;
  const notes = [261.63, 329.63, 392, 523.25];
  const oscillators: OscillatorNode[] = [];
  const envelopes: GainNode[] = [];

  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    oscillator.type = index === 0 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1500 + index * 240;

    const envelope = ctx.createGain();
    const start = now + index * 0.16;
    const peak = index === 0 ? 0.22 : 0.14;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + 0.34);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(dest);
    oscillator.start(start);
    oscillator.stop(now + 4);
    oscillators.push(oscillator);
    envelopes.push(envelope);
  });

  let stopped = false;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Already ended on its scheduled stop.
      }
    });
    active = null;
    started = false;
  };

  const naturalStop = window.setTimeout(finish, 4100);

  active = {
    stop: () => {
      window.clearTimeout(naturalStop);
      const stopNow = ctx.currentTime;
      envelopes.forEach((envelope) => {
        envelope.gain.cancelScheduledValues(stopNow);
        envelope.gain.setValueAtTime(Math.max(envelope.gain.value, 0.0001), stopNow);
        envelope.gain.exponentialRampToValueAtTime(0.0001, stopNow + 0.25);
      });
      window.setTimeout(finish, 300);
    },
  };
}

export function stopAmbient(): void {
  active?.stop();
  active = null;
  started = false;
}

// A brief, gentle dip so an important confirmation sound gets sonic space
// (spec §29) without an abrupt cut.
export function duckAmbient(): void {
  const ctx = getAudioContext();
  const dest = getAmbientGain();
  if (!ctx || !dest || !started) return;
  const now = ctx.currentTime;
  const current = dest.gain.value;
  dest.gain.cancelScheduledValues(now);
  dest.gain.setValueAtTime(current, now);
  dest.gain.linearRampToValueAtTime(current * 0.7, now + 0.15);
  dest.gain.linearRampToValueAtTime(current, now + 0.65);
}
