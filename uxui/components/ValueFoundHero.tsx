"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

export function ValueFoundHero({ total, opportunityCount }: { total: number; opportunityCount: number }) {
  const [display, setDisplay] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();
  const playedDiscovery = useRef(false);
  const visibleValue = shouldReduceMotion ? total : display;
  const isComplete = visibleValue >= total;

  useEffect(() => {
    if (shouldReduceMotion) return;
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(total * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, shouldReduceMotion]);

  useEffect(() => {
    if (!isComplete || playedDiscovery.current) return;
    playedDiscovery.current = true;
    play("discovery");
  }, [isComplete, play]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl bg-card border border-line p-8 text-center"
      animate={
        shouldReduceMotion
          ? undefined
          : { boxShadow: isComplete ? "0 18px 50px rgba(31, 122, 77, 0.13)" : "0 0 0 rgba(31, 122, 77, 0)" }
      }
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easeOut }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-10 -top-16 h-32 rounded-full bg-success-soft blur-2xl"
        initial={false}
        animate={{ opacity: isComplete ? 0.85 : 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : motionTokens.duration.slow }}
        aria-hidden="true"
      />
      <p className="text-[13px] text-ink-muted mb-2">We found</p>
      <p className="relative text-5xl sm:text-6xl font-medium tabular-nums text-success tracking-tight">
        ${visibleValue.toLocaleString("en-CA")}
      </p>
      <p className="text-[14px] text-ink-soft mt-2">potential value found</p>
      <p className="text-[13px] text-ink-muted mt-4">
        {opportunityCount} opportunities appear worth pursuing
      </p>
    </motion.div>
  );
}
