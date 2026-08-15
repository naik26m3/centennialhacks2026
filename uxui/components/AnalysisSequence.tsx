"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

const STEPS = [
  "Reading document",
  "Toronto, Ontario",
  "Residential gas account · Enbridge Gas detected",
  "Billing structure detected",
  "Potential efficiency opportunity detected",
  "Building household profile",
  "Searching programs",
  "Resolving administrators and required actions",
];

export function AnalysisSequence() {
  const router = useRouter();
  const { bills, household, hydrated } = useGreenlight();
  const { play } = useGreenlightAudio();
  const shouldReduceMotion = useReducedMotion();
  const [visibleCount, setVisibleCount] = useState(0);
  const renderedCount = shouldReduceMotion ? STEPS.length : visibleCount;

  useEffect(() => {
    if (!hydrated) return;
    if (bills.length === 0 || !household) {
      router.replace("/");
      return;
    }
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= STEPS.length) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 280);
    return () => clearInterval(interval);
  }, [hydrated, bills, household, router, shouldReduceMotion]);

  useEffect(() => {
    if (visibleCount > 0 && !shouldReduceMotion) play("step", { gainScale: Math.max(0.55, 1 - visibleCount * 0.05) });
  }, [visibleCount, shouldReduceMotion, play]);

  useEffect(() => {
    if (renderedCount >= STEPS.length) {
      const t = setTimeout(() => router.push("/opportunities"), shouldReduceMotion ? 0 : 500);
      return () => clearTimeout(t);
    }
  }, [renderedCount, router, shouldReduceMotion]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <ul className="flex flex-col gap-3">
          <AnimatePresence>
            {STEPS.slice(0, renderedCount).map((step, i) => (
              <motion.li
                key={step}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easeOut }}
                className="flex items-center gap-3 text-[14px]"
              >
                <CheckCircle2 size={16} className="text-success shrink-0" aria-hidden="true" />
                <span className={i === renderedCount - 1 ? "text-ink" : "text-ink-soft"}>{step}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}
