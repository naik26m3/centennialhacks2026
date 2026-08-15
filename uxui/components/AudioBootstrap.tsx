"use client";

import { useEffect } from "react";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";

// Renders nothing — just waits for the app's first pointer/keyboard
// interaction (browsers block audio before a real user gesture) and starts
// the ambient bed then, per spec §22/§59. Mounted once in app/layout.tsx.
export function AudioBootstrap() {
  const { beginAmbientIfAllowed } = useGreenlightAudio();

  useEffect(() => {
    const onFirstInteraction = () => {
      beginAmbientIfAllowed();
    };
    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, [beginAmbientIfAllowed]);

  return null;
}
