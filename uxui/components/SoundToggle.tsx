"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";

export function SoundToggle() {
  const { muted, toggleMuted } = useGreenlightAudio();

  return (
    <button
      onClick={toggleMuted}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      title={muted ? "Sound off" : "Sound on"}
      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-card transition-colors"
    >
      {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
    </button>
  );
}
