"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, FileQuestion, Hand } from "lucide-react";
import { ApplicationField } from "@/lib/types";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

const sourceLabel: Record<ApplicationField["source"], string> = {
  extracted: "from bill",
  confirmed: "human confirmed",
  calculated: "calculated",
  missing: "still needed",
  declaration: "requires you",
};

export function ApplicationPacket({ fields }: { fields: ApplicationField[] }) {
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();
  const [visibleCount, setVisibleCount] = useState(shouldReduceMotion ? fields.length : 3);
  const visibleFields = fields.slice(0, shouldReduceMotion ? fields.length : visibleCount);
  const complete = visibleFields.filter((field) => !["missing", "declaration"].includes(field.source)).length;

  useEffect(() => {
    if (shouldReduceMotion || visibleCount >= fields.length) return;
    const timer = window.setTimeout(() => {
      if (visibleCount === 3 || visibleCount === fields.length - 1) play("step", { gainScale: 0.42 });
      setVisibleCount((count) => Math.min(count + 1, fields.length));
    }, 105);
    return () => window.clearTimeout(timer);
  }, [fields.length, play, shouldReduceMotion, visibleCount]);

  return (
    <motion.section className="rounded-2xl border border-line bg-card p-4" initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.standard, ease: motionTokens.easeOut }}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="text-[12px] font-medium text-brand">Application readiness</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">{complete} fields you do not have to fill</h2></div>
        <span className="shrink-0 text-xl font-semibold tabular-nums">{complete} / {fields.length}</span>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {visibleFields.map((field) => {
            const incomplete = field.source === "missing" || field.source === "declaration";
            const Icon = field.source === "declaration" ? Hand : incomplete ? FileQuestion : CheckCircle2;
            return (
              <motion.div key={field.key} initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-canvas/75 p-3">
                <div className="flex items-start gap-2.5"><Icon size={15} className={`mt-0.5 shrink-0 ${incomplete ? "text-warning" : "text-success"}`} aria-hidden="true" /><div className="min-w-0"><dt className="text-[11px] text-ink-muted">{field.label}</dt><dd className={`truncate text-[12px] font-semibold capitalize ${incomplete ? "text-warning" : "text-ink"}`}>{field.value || (field.source === "declaration" ? "Applicant action" : "Needs input")}</dd><span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{sourceLabel[field.source]}</span></div></div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </dl>
    </motion.section>
  );
}
