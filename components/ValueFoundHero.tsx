"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Opportunity } from "@/lib/types";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

export function ValueFoundHero({ opportunities }: { opportunities: Opportunity[] }) {
  const pursuable = opportunities.filter((opportunity) => opportunity.status !== "not_eligible");
  const total = pursuable.reduce((sum, opportunity) => sum + opportunity.estimatedIncentive, 0);
  const [display, setDisplay] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();
  const playedDiscovery = useRef(false);
  const visibleValue = shouldReduceMotion ? total : display;
  const isComplete = visibleValue >= total;

  useEffect(() => {
    if (shouldReduceMotion) return;
    const duration = 780;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(total * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, shouldReduceMotion]);

  useEffect(() => {
    if (!isComplete || playedDiscovery.current) return;
    playedDiscovery.current = true;
    play("discovery");
  }, [isComplete, play]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border border-line bg-card p-6 sm:p-8"
      animate={shouldReduceMotion ? undefined : { boxShadow: isComplete ? "0 22px 60px rgba(31, 122, 77, 0.13)" : "0 0 0 rgba(31, 122, 77, 0)" }}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easeOut }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-8 -top-16 h-32 rounded-full bg-success-soft blur-2xl"
        initial={false}
        animate={{ opacity: isComplete ? 0.82 : 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : motionTokens.duration.slow }}
        aria-hidden="true"
      />
      <p className="relative text-[12px] font-medium text-brand">After deterministic eligibility checks</p>
      <p className="relative mt-2 text-5xl font-semibold tracking-[-0.055em] text-success tabular-nums sm:text-6xl">
        ${visibleValue.toLocaleString("en-CA")}
      </p>
      <p className="relative mt-1 text-[15px] font-medium text-ink">worth pursuing.</p>
      <p className="relative mt-3 text-[12px] leading-relaxed text-ink-muted">
        Potential incentive value across {pursuable.length} opportunities. Estimates remain subject to verification.
      </p>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="relative mt-5 flex w-full items-center justify-between border-t border-line pt-4 text-left text-[12px] font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-expanded={expanded}
      >
        Where does ${total.toLocaleString("en-CA")} come from?
        <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.dl
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2 overflow-hidden"
          >
            {pursuable.map((opportunity) => (
              <div key={opportunity.id} className="flex items-start justify-between gap-4 text-[12px]">
                <dt className="text-ink-soft">{opportunity.title}</dt>
                <dd className="shrink-0 font-semibold tabular-nums">${opportunity.estimatedIncentive.toLocaleString("en-CA")}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
