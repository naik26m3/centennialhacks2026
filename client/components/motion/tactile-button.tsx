import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, type PressableProps } from "react-native";
import { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { AnimatedPressable } from "@/lib/motion/animated";
import { motionTokens } from "@/lib/motion/tokens";
import { useGreenlightAudio } from "@/hooks/use-greenlight-audio";

// Ported from uxui/components/motion/TactileButton.tsx: press compresses,
// release springs back, and a tap tone plays. There is no hover on touch, so
// the web version's hover lift is dropped.
//
// `playSound={false}` for buttons that trigger their own more specific sound,
// so they don't double up — same escape hatch as the web component.
export function TactileButton({
  children,
  className,
  onPress,
  playSound = true,
  ...props
}: PressableProps & { children: ReactNode; className?: string; playSound?: boolean }) {
  const [reduced, setReduced] = useState(false);
  const { play } = useGreenlightAudio();
  const pressed = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.015 }],
  }));

  return (
    <AnimatedPressable
      className={className}
      style={animatedStyle}
      onPressIn={() => {
        if (!reduced) pressed.value = withSpring(1, motionTokens.springSnappy);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, motionTokens.springSnappy);
      }}
      onPress={(e) => {
        if (playSound) play("tap");
        onPress?.(e);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
