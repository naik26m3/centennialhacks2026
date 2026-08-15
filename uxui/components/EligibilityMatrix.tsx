"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ChevronDown, HelpCircle, XCircle } from "lucide-react";
import { EligibilityEvidence } from "@/lib/types";

const icons = {
  pass: <CheckCircle2 size={16} className="text-success" aria-hidden="true" />,
  fail: <XCircle size={16} className="text-danger" aria-hidden="true" />,
  unknown: <HelpCircle size={16} className="text-warning" aria-hidden="true" />,
  manual_review: <HelpCircle size={16} className="text-warning" aria-hidden="true" />,
};

export function EligibilityMatrix({ evidence }: { evidence: EligibilityEvidence[] }) {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
      {evidence.map((item) => {
        const expanded = open === item.criterion;
        return (
          <div key={item.criterion}>
            <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : item.criterion)} className="flex w-full items-start gap-3 p-3.5 text-left hover:bg-canvas/65 focus-visible:outline-2 focus-visible:outline-brand">
              <span className="mt-0.5">{icons[item.status]}</span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{item.criterion}</span><span className="mt-0.5 block text-[12px] text-ink-muted">{item.observedValue || "not confirmed"} · expected {item.expectedValue}</span></span>
              <ChevronDown size={15} className={`mt-1 shrink-0 text-ink-muted transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {expanded && <motion.div initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="border-t border-line bg-canvas/55 px-11 py-3"><p className="text-[11px] font-semibold text-brand">Evidence trail</p><p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{item.source}</p><p className="mt-2 text-[11px] text-ink-muted">This rule is evaluated deterministically from the observed and expected values above.</p></div></motion.div>}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
