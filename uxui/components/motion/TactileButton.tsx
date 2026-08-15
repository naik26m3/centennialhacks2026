"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ButtonHTMLAttributes, MouseEvent, forwardRef } from "react";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

// framer-motion's drag/animation event props collide in type with React's
// native HTML ones of the same name (a well-known framer-motion + TS
// friction point) — omit the ones this button never needs.
type ConflictingNativeProps = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration";

interface TactileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingNativeProps> {
  // Most clicks get the shared "tap" tone; pass false for buttons that
  // trigger their own more specific sound (e.g. "Get it for me" plays its
  // own confirmation elsewhere) so they don't double up.
  playSound?: boolean;
}

// A physical-feeling button: hover lift, press compress, spring release —
// drop-in replacement for <button> so existing styling/props keep working.
// Falls back to a plain, unanimated <button> under reduced motion.
export const TactileButton = forwardRef<HTMLButtonElement, TactileButtonProps>(function TactileButton(
  { onClick, playSound = true, children, ...props },
  ref
) {
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (playSound) play("tap");
    onClick?.(e);
  };

  return (
    <motion.button
      ref={ref}
      onClick={handleClick}
      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
      // Keep the tap gesture prop present in both server and client markup.
      // Framer adds keyboard accessibility attributes when whileTap exists;
      // removing it only on a reduced-motion client causes hydration drift.
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.985 }}
      transition={shouldReduceMotion ? { duration: 0 } : motionTokens.springSnappy}
      {...props}
    >
      {children}
    </motion.button>
  );
});
