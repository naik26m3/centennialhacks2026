// NativeWind only knows how to turn `className` into styles for components it
// has been told about. Reanimated's `Animated.View` and anything from
// `createAnimatedComponent` are new components it has never seen, so a
// `className` on them is silently dropped — which is how the upload panel lost
// its dashed border and the CTA buttons lost their fill.
//
// `cssInterop` registers them once, here, so every motion component can take
// className and an animated style together.

import { Pressable } from "react-native";
import Animated from "react-native-reanimated";
import { cssInterop } from "nativewind";

export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

cssInterop(Animated.View, { className: "style" });
cssInterop(AnimatedPressable, { className: "style" });

export { Animated };
