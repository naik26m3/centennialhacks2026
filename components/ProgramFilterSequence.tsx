"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { ProgramFilterSummary } from "@/lib/types";
import { motionTokens } from "@/lib/motion/tokens";

export function ProgramFilterSequence({ summary, visibleRows }: { summary: ProgramFilterSummary; visibleRows: number }) {
  const shouldReduceMotion = useReducedMotion();
  const excluded = summary.excludedJurisdiction + summary.excludedProvider + summary.excludedHousehold;
  const rows = [
    { label: "Tracked Ontario programs reviewed", value: summary.considered, icon: CheckCircle2, tone: "text-brand" },
    { label: "Ruled out by known household facts", value: excluded, icon: XCircle, tone: excluded > 0 ? "text-danger" : "text-ink-muted" },
    { label: "Need one missing fact", value: summary.unresolved, icon: HelpCircle, tone: "text-warning" },
    { label: "Can move forward now", value: summary.matched, icon: CheckCircle2, tone: "text-success" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Most programs are not yours. Let&apos;s prove which ones are.</h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-ink-soft">Greenlight applies structured household facts before any value is counted.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_60px_rgba(39,58,45,0.08)]">
        {rows.slice(0, shouldReduceMotion ? rows.length : visibleRows).map((row, index) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.label}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: motionTokens.duration.standard, ease: motionTokens.easeOut }}
              className="flex items-center gap-4 border-b border-line p-4 last:border-b-0 sm:px-6"
            >
              <Icon size={18} className={row.tone} aria-hidden="true" />
              <span className="flex-1 text-[14px] text-ink-soft">{row.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{row.value}</span>
              {index < rows.length - 1 && <span className="w-10 text-right text-[11px] text-ink-muted">of {summary.considered}</span>}
            </motion.div>
          );
        })}
      </div>
      <motion.p
        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: visibleRows >= rows.length ? 1 : 0, y: visibleRows >= rows.length ? 0 : 8 }}
        className="mt-6 text-center text-xl font-semibold text-brand"
      >
        {summary.matched + summary.unresolved} worth investigating.
      </motion.p>
    </div>
  );
}
