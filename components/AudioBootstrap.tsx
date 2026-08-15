"use client";

import { useEffect } from "react";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";

// Renders nothing. It waits for the first real interaction, then plays the
// short session welcome. Browsers do not permit sound before a gesture.
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
