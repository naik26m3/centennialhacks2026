import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { CinematicReveal } from "@/components/motion/cinematic-reveal";
import { Text } from "@/components/ui/text";
import { useGreenlightAudio } from "@/hooks/use-greenlight-audio";
import type { Opportunity } from "@/lib/types";
import type { Variant } from "@/lib/nav";

// Ported from uxui/components/ValueFoundHero.tsx (final design).
//
// The number counts up with an ease-out cubic, then the card can be expanded to
// show where the total came from — the brief's "evidence over AI confidence"
// applied to the hero number itself.
export function ValueFoundHero({
  opportunities,
  variant,
}: {
  opportunities: Opportunity[];
  variant: Variant;
}) {
  const pursuable = opportunities.filter((o) => o.status !== "not_eligible");
  const total = pursuable.reduce((sum, o) => sum + o.estimatedIncentive, 0);

  const [display, setDisplay] = useState(total);
  const [expanded, setExpanded] = useState(false);
  const { play } = useGreenlightAudio();
  const playedDiscovery = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let frame: number;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      const duration = 780;
      const start = Date.now();
      setDisplay(0);
      const tick = () => {
        const progress = Math.min(1, (Date.now() - start) / duration);
        // ease-out cubic, matching the web build
        setDisplay(Math.round(total * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [total]);

  // The "discovery" tone lands when the number finishes climbing — the moment
  // the value reveal completes (uxui plays it at the same beat).
  useEffect(() => {
    if (display < total || playedDiscovery.current) return;
    playedDiscovery.current = true;
    play("discovery");
  }, [display, total, play]);

  return (
    <View className="overflow-hidden rounded-2xl border border-line bg-card p-6 sm:p-8">
      <Text className="text-[12px] font-medium text-brand">After deterministic eligibility checks</Text>

      <Text
        className={`mt-2 font-semibold text-success tabular-nums ${variant === "web" ? "text-6xl" : "text-5xl"}`}
        style={{ letterSpacing: -2.6 }}
      >
        ${display.toLocaleString("en-CA")}
      </Text>

      <Text className="mt-1 text-[15px] font-medium text-ink">worth pursuing.</Text>

      <Text className="mt-3 text-[12px] leading-relaxed text-ink-muted">
        Potential incentive value across {pursuable.length} opportunities. Estimates remain subject to
        verification.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        className="mt-5 flex-row items-center justify-between border-t border-line pt-4"
      >
        <Text className="text-[12px] font-semibold text-brand">
          Where does ${total.toLocaleString("en-CA")} come from?
        </Text>
        <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
          <ChevronDown size={16} color="#1f5c3f" />
        </View>
      </Pressable>

      {expanded && (
        <CinematicReveal className="mt-3 gap-2">
          {pursuable.map((o) => (
            <View key={o.id} className="flex-row items-start justify-between gap-4">
              <Text className="flex-1 text-[12px] text-ink-soft">{o.title}</Text>
              <Text className="text-[12px] font-semibold text-ink tabular-nums">
                ${o.estimatedIncentive.toLocaleString("en-CA")}
              </Text>
            </View>
          ))}
        </CinematicReveal>
      )}
    </View>
  );
}
