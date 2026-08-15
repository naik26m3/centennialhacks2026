import { useEffect } from "react";
import { AccessibilityInfo, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

// Ported from uxui/components/AmbientBackground.tsx.
//
// The web version also parallaxes with the pointer; that is deliberately dropped
// here because there is no pointer on a phone, and `useFinePointer` disables it
// on touch devices anyway. The slow scale drift and the layered warm gradients
// are what carry the effect, and both port cleanly.
const DRIFT_MS = 8000; // half of the web version's 16s cycle

export function AmbientBackground() {
  const drift = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      drift.value = withRepeat(
        withSequence(
          withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: DRIFT_MS, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    });
    return () => {
      cancelled = true;
      cancelAnimation(drift);
    };
  }, [drift]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.02 + drift.value * 0.015 }],
  }));

  return (
    <View className="absolute inset-0 overflow-hidden bg-[#dce3db]" pointerEvents="none" accessible={false}>
      <Animated.View style={[{ position: "absolute", top: -12, left: -12, right: -12, bottom: -12 }, imageStyle]}>
        <Image
          source={require("@/assets/images/greenlight-meadow.webp")}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          contentPosition="center"
          transition={300}
        />
      </Animated.View>

      {/* Top-to-bottom wash: pale at the top so the headline reads, deep green
          at the base so the upload panel sits on something solid. */}
      <LinearGradient
        colors={["rgba(244,246,240,0.44)", "rgba(246,242,226,0.16)", "rgba(24,55,35,0.20)"]}
        locations={[0, 0.52, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Stands in for the web build's radial glow behind the headline. */}
      <LinearGradient
        colors={["rgba(250,249,245,0.46)", "transparent"]}
        locations={[0, 0.42]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "55%" }}
      />
    </View>
  );
}
