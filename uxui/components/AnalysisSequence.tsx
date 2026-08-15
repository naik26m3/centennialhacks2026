"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { objectiveLabel, deriveProgramFilterSummary } from "@/lib/experience";
import { DocumentIntelligence } from "@/components/DocumentIntelligence";
import { ProgramFilterSequence } from "@/components/ProgramFilterSequence";
import { motionTokens } from "@/lib/motion/tokens";

const FACT_COUNT = 6;
const FILTER_ROW_COUNT = 4;

export function AnalysisSequence() {
  const router = useRouter();
  const { bills, household, opportunities, objective, hydrated } = useGreenlight();
  const { play } = useGreenlightAudio();
  const shouldReduceMotion = useReducedMotion();
  const [scene, setScene] = useState<"document" | "filter">("document");
  const [visibleFacts, setVisibleFacts] = useState(shouldReduceMotion ? FACT_COUNT : 0);
  const [visibleRows, setVisibleRows] = useState(shouldReduceMotion ? FILTER_ROW_COUNT : 0);

  useEffect(() => {
    if (!hydrated) return;
    if (bills.length === 0 || !household) router.replace("/");
  }, [bills.length, household, hydrated, router]);

  useEffect(() => {
    if (scene !== "document") return;
    if (shouldReduceMotion) {
      const timer = window.setTimeout(() => setScene("filter"), 600);
      return () => window.clearTimeout(timer);
    }
    if (visibleFacts < FACT_COUNT) {
      const timer = window.setTimeout(() => {
        if (visibleFacts === 0 || visibleFacts === 3) play("step", { gainScale: 0.55 });
        setVisibleFacts((count) => count + 1);
      }, visibleFacts === 0 ? 180 : 210);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setScene("filter"), 650);
    return () => window.clearTimeout(timer);
  }, [play, scene, shouldReduceMotion, visibleFacts]);

  useEffect(() => {
    if (scene !== "filter") return;
    if (shouldReduceMotion) {
      const timer = window.setTimeout(() => router.push("/opportunities"), 700);
      return () => window.clearTimeout(timer);
    }
    if (visibleRows < FILTER_ROW_COUNT) {
      const timer = window.setTimeout(() => {
        if (visibleRows === 0 || visibleRows === 3) play("step", { gainScale: 0.5 });
        setVisibleRows((count) => count + 1);
      }, 230);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => router.push("/opportunities"), 800);
    return () => window.clearTimeout(timer);
  }, [play, router, scene, shouldReduceMotion, visibleRows]);

  if (!household || bills.length === 0) return null;

  const summary = deriveProgramFilterSummary(opportunities);

  return (
    <div className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-medium text-brand">Optimizing for: {objectiveLabel(objective)}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {scene === "document" ? "Let's see what your bill knows." : "Now remove what does not fit."}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/opportunities")}
            className="shrink-0 rounded-lg border border-line bg-card px-3 py-2 text-[12px] font-medium text-ink-soft hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Show results now
          </button>
        </div>

        <AnimatePresence mode="wait">
          {scene === "document" ? (
            <motion.div
              key="document"
              initial={false}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: motionTokens.duration.standard }}
            >
              <DocumentIntelligence bill={bills[0]} household={household} visibleFacts={visibleFacts} />
            </motion.div>
          ) : (
            <motion.div
              key="filter"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.standard, ease: motionTokens.easeOut }}
              className="py-8 sm:py-12"
            >
              <ProgramFilterSequence summary={summary} visibleRows={shouldReduceMotion ? FILTER_ROW_COUNT : visibleRows} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
