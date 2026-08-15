"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";
import { motionTokens } from "@/lib/motion/tokens";

// The app-wide reveal for panels/list items/text: fade + rise + soften from
// a blur. Collapses to an instant, unanimated render under
// prefers-reduced-motion (spec §38).
export function CinematicReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: shouldReduceMotion ? 0 : motionTokens.duration.standard,
        delay: shouldReduceMotion ? 0 : delay,
        ease: motionTokens.easeOut,
      }}
    >
      {children}
    </motion.div>
  );
}
