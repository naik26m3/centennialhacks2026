import { useEffect, type ReactNode } from "react";
import { AccessibilityInfo, type ViewProps } from "react-native";
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Animated } from "@/lib/motion/animated";

// Ported from uxui/components/motion/BreathingSurface.tsx.
//
// Spec §4: this should register as "this feels alive", not as a visible pulse —
// hence the 1.008 scale and the 7-second cycle. Disabled under reduced motion.
const CYCLE_MS = 3500; // half of the 7s round trip

export function BreathingSurface({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: ViewProps["style"];
}) {
  const breath = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      breath.value = withRepeat(
        withSequence(
          withTiming(1, { duration: CYCLE_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: CYCLE_MS, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    });
    return () => {
      cancelled = true;
      cancelAnimation(breath);
    };
  }, [breath]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.008 }],
    opacity: 1 - breath.value * 0.015,
  }));

  return (
    <Animated.View className={className} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
