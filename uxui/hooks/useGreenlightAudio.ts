"use client";

import { useCallback, useSyncExternalStore } from "react";
import { initAudio, setMuted as engineSetMuted } from "@/lib/audio/audio-engine";
import { playSound, SoundName } from "@/lib/audio/sounds";
import { duckAmbient, startAmbient, stopAmbient } from "@/lib/audio/ambient";
import {
  getMutePreferenceSnapshot,
  getServerMutePreferenceSnapshot,
  saveMutePreference,
  subscribeMutePreference,
} from "@/lib/audio/preferences";

// Components only ever call audio.play("tap") etc. — they never touch the
// engine, the AudioContext, or a file name directly (spec §44).
export function useGreenlightAudio() {
  const muted = useSyncExternalStore(subscribeMutePreference, getMutePreferenceSnapshot, getServerMutePreferenceSnapshot);

  const play = useCallback((name: SoundName, opts?: { gainScale?: number }) => {
    initAudio();
    playSound(name, opts);
  }, []);

  const toggleMuted = useCallback(() => {
    const next = !getMutePreferenceSnapshot();
    engineSetMuted(next);
    saveMutePreference(next);
    if (next) {
      stopAmbient();
    } else {
      initAudio();
      startAmbient();
    }
  }, []);

  // Called on the app's first pointer/keyboard interaction (see
  // components/AudioBootstrap.tsx) — starts the ambient bed only if the
  // user hasn't previously muted.
  const beginAmbientIfAllowed = useCallback(() => {
    initAudio();
    engineSetMuted(getMutePreferenceSnapshot());
    if (!getMutePreferenceSnapshot()) startAmbient();
  }, []);

  return { play, muted, toggleMuted, beginAmbientIfAllowed, duck: duckAmbient };
}
