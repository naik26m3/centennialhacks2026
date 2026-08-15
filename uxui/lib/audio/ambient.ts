// The atmospheric bed — synthesized, not a field recording (spec §25/§50:
// no obvious nature loops, no melody, no drums). A slow detuned pad plus a
// very quiet filtered-noise texture for air, both crossfading in/out rather
// than starting abruptly. Overall level is controlled by the ambient bus
// gain in audio-engine.ts; the internal gains here just fade in/out.

import { getAmbientGain, getAudioContext, isAudioInitialized } from "@/lib/audio/audio-engine";

interface AmbientNodes {
  stop: () => void;
}

let started = false;
let active: AmbientNodes | null = null;

function buildNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  return buffer;
}

export function startAmbient(): void {
  if (started || !isAudioInitialized()) return;
  const ctx = getAudioContext();
  const dest = getAmbientGain();
  if (!ctx || !dest) return;
  started = true;

  const oscLow = ctx.createOscillator();
  oscLow.type = "sine";
  oscLow.frequency.value = 98;

  const oscFifth = ctx.createOscillator();
  oscFifth.type = "sine";
  oscFifth.frequency.value = 147;
  oscFifth.detune.value = 4;

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 500;

  const padGain = ctx.createGain();
  padGain.gain.value = 0;

  oscLow.connect(padFilter);
  oscFifth.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(dest);

  // Slow LFO breathing the filter cutoff so the pad drifts instead of
  // sitting static — roughly a 20s cycle, well under conscious notice.
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.05;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 150;
  lfo.connect(lfoDepth);
  lfoDepth.connect(padFilter.frequency);

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buildNoiseBuffer(ctx, 4);
  noiseSource.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 900;
  noiseFilter.Q.value = 0.6;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);

  oscLow.start();
  oscFifth.start();
  lfo.start();
  noiseSource.start();

  const now = ctx.currentTime;
  padGain.gain.linearRampToValueAtTime(0.6, now + 3);
  noiseGain.gain.linearRampToValueAtTime(0.15, now + 3);

  active = {
    stop: () => {
      const stopNow = ctx.currentTime;
      padGain.gain.cancelScheduledValues(stopNow);
      padGain.gain.setValueAtTime(padGain.gain.value, stopNow);
      padGain.gain.linearRampToValueAtTime(0, stopNow + 1);
      noiseGain.gain.cancelScheduledValues(stopNow);
      noiseGain.gain.setValueAtTime(noiseGain.gain.value, stopNow);
      noiseGain.gain.linearRampToValueAtTime(0, stopNow + 1);
      setTimeout(() => {
        oscLow.stop();
        oscFifth.stop();
        lfo.stop();
        noiseSource.stop();
      }, 1100);
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
