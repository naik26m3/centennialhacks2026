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

const WELCOME_PLAYED_KEY = "greenlight:welcome-played";

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

  // Play one short welcome bloom per browser-tab session. sessionStorage
  // survives route changes and reloads, then resets when the browsing
  // session ends. This prevents a persistent tone or repeated page chime.
  const beginAmbientIfAllowed = useCallback(() => {
    initAudio();
    engineSetMuted(getMutePreferenceSnapshot());
    if (getMutePreferenceSnapshot()) return;
    try {
      if (window.sessionStorage.getItem(WELCOME_PLAYED_KEY) === "true") return;
      window.sessionStorage.setItem(WELCOME_PLAYED_KEY, "true");
    } catch {
      // If storage is unavailable, a single mount-scoped attempt is still safe.
    }
    startAmbient();
  }, []);

  return { play, muted, toggleMuted, beginAmbientIfAllowed, duck: duckAmbient };
}
