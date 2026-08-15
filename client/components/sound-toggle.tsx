import { useEffect } from "react";
import { Pressable } from "react-native";
import { Volume2, VolumeX } from "lucide-react-native";
import { useGreenlightAudio } from "@/hooks/use-greenlight-audio";

// Ported from uxui/components/SoundToggle.tsx, with uxui's AudioBootstrap folded
// in: the welcome chime fires on the first interaction, because browsers block
// audio until a user gesture.
export function SoundToggle({ tint = "#8a897f" }: { tint?: string }) {
  const { muted, toggleMuted, beginAmbientIfAllowed, supported } = useGreenlightAudio();

  useEffect(() => {
    if (!supported || typeof window === "undefined") return;
    const onFirst = () => beginAmbientIfAllowed();
    window.addEventListener("pointerdown", onFirst, { once: true });
    window.addEventListener("keydown", onFirst, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirst);
      window.removeEventListener("keydown", onFirst);
    };
  }, [beginAmbientIfAllowed, supported]);

  // Native has no Web Audio API, so the control would be a lie there.
  if (!supported) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"}
      onPress={toggleMuted}
      className="h-8 w-8 items-center justify-center rounded-full"
    >
      {muted ? <VolumeX size={16} color={tint} /> : <Volume2 size={16} color={tint} />}
    </Pressable>
  );
}
