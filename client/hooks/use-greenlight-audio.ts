import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { initAudio, setMuted as engineSetMuted } from "@/lib/audio/audio-engine";
import { playSound, type SoundName } from "@/lib/audio/sounds";
import { startAmbient, stopAmbient } from "@/lib/audio/ambient";
import {
  getMutePreferenceSnapshot,
  saveMutePreference,
  subscribeMutePreference,
} from "@/lib/audio/preferences";

// Ported from uxui/hooks/useGreenlightAudio.ts.
//
// The engine underneath is the Web Audio API, which exists in the browser but
// not in React Native's JS runtime. Rather than stub the sounds out, the engine
// already returns null when there is no AudioContext, so every call is a safe
// no-op on native — the web build gets sound, the native build stays silent.
// Replacing this with expo-audio would give native sound too; see README.
const WELCOME_PLAYED_KEY = "greenlight:welcome-played";
const isWeb = Platform.OS === "web";

export function useGreenlightAudio() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    if (!isWeb) return;
    setMutedState(getMutePreferenceSnapshot());
    return subscribeMutePreference(() => setMutedState(getMutePreferenceSnapshot()));
  }, []);

  const play = useCallback((name: SoundName, opts?: { gainScale?: number }) => {
    if (!isWeb) return;
    initAudio();
    playSound(name, opts);
  }, []);

  const toggleMuted = useCallback(() => {
    if (!isWeb) return;
    const next = !getMutePreferenceSnapshot();
    engineSetMuted(next);
    saveMutePreference(next);
    if (next) stopAmbient();
    else {
      initAudio();
      startAmbient();
    }
  }, []);

  // One short welcome per browser-tab session, played on the first real
  // interaction — browsers refuse audio before a user gesture.
  const beginAmbientIfAllowed = useCallback(() => {
    if (!isWeb) return;
    initAudio();
    engineSetMuted(getMutePreferenceSnapshot());
    if (getMutePreferenceSnapshot()) return;
    try {
      if (window.sessionStorage.getItem(WELCOME_PLAYED_KEY) === "true") return;
      window.sessionStorage.setItem(WELCOME_PLAYED_KEY, "true");
    } catch {
      // storage unavailable — worst case the chime plays again next navigation
    }
    playSound("discovery", { gainScale: 0.7 });
  }, []);

  return { muted, play, toggleMuted, beginAmbientIfAllowed, supported: isWeb };
}
