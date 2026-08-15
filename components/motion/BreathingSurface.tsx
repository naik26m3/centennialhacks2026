"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

// An extremely subtle idle "breathing" loop — used sparingly (hero panel,
// ambient background) per spec §4: it should register as "this feels alive,"
// not as a visible pulsing animation. Disabled under reduced motion.
export function BreathingSurface({ children, className }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={shouldReduceMotion ? undefined : { scale: [1, 1.008, 1], opacity: [1, 0.985, 1] }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}
