import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, type ViewProps } from "react-native";
import { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Animated } from "@/lib/motion/animated";
import { motionTokens } from "@/lib/motion/tokens";

// Ported from uxui/components/motion/CinematicReveal.tsx: fade + rise on entry.
//
// The web version also animates a blur, which React Native cannot animate on a
// view — so this ports the fade and the rise, and drops the blur rather than
// faking it. Collapses to an instant render under reduced motion (spec §38).
export function CinematicReveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  /** Seconds, matching the web component's API. */
  delay?: number;
  className?: string;
  style?: ViewProps["style"];
}) {
  // Starts revealed. Anything else means the content is absent from the static
  // HTML (and invisible if JS never runs), which is how the headline went
  // missing the first time this was ported.
  const progress = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (cancelled || enabled) return;
      // Only once we know motion is wanted do we rewind and play the reveal.
      progress.value = 0;
      progress.value = withDelay(
        delay * 1000,
        withTiming(1, {
          duration: motionTokens.ms.standard,
          easing: Easing.bezier(...motionTokens.easeOut),
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  return (
    <Animated.View className={className} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
