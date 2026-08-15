"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, FileSearch, HelpCircle } from "lucide-react";
import { Opportunity } from "@/lib/types";
import { INCENTIVE_PROGRAMS } from "@/lib/data/fixtures";
import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import { motionTokens } from "@/lib/motion/tokens";

type Interrogation = "why" | "block" | "evidence" | null;

const statusLabel: Record<Opportunity["status"], string> = {
  ready_to_pursue: "Ready to pursue",
  needs_answers: "Needs one answer",
  not_eligible: "Blocked by known facts",
};

const statusTone: Record<Opportunity["status"], string> = {
  ready_to_pursue: "text-success bg-success-soft",
  needs_answers: "text-warning bg-warning-soft",
  not_eligible: "text-danger bg-danger-soft",
};

export function OpportunityRow({ opportunity, recommended = false }: { opportunity: Opportunity; recommended?: boolean }) {
  const shouldReduceMotion = useReducedMotion();
  const [active, setActive] = useState<Interrogation>(null);
  const program = INCENTIVE_PROGRAMS.find((item) => item.id === opportunity.incentiveId);
  const passed = opportunity.evidence.filter((item) => item.status === "pass");
  const unresolved = opportunity.evidence.filter((item) => item.status === "unknown" || item.status === "manual_review");
  const failed = opportunity.evidence.filter((item) => item.status === "fail");

  const toggle = (next: Exclude<Interrogation, null>) => setActive((current) => current === next ? null : next);

  return (
    <motion.article
      layout
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={motionTokens.springSoft}
      className={`overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] ${recommended ? "border-brand/45 shadow-[0_14px_38px_rgba(31,92,63,0.10)]" : "border-line hover:border-line-strong"}`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {recommended && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">Recommended for your objective</p>}
            <Link href={`/opportunity/${opportunity.id}`} className="group inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.015em] hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {opportunity.title}<ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <span className="text-[13px] font-semibold text-success tabular-nums">Up to ${opportunity.estimatedIncentive.toLocaleString("en-CA")}</span>
              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusTone[opportunity.status]}`}>{statusLabel[opportunity.status]}</span>
            </div>
            <div className="mt-2"><ConfidenceIndicator confidence={opportunity.eligibilityConfidence} /></div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-line pt-3">
          <button type="button" onClick={() => toggle("why")} className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand ${active === "why" ? "bg-brand text-white" : "bg-canvas text-ink-soft hover:text-ink"}`}>Why me?</button>
          <button type="button" onClick={() => toggle("block")} className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand ${active === "block" ? "bg-brand text-white" : "bg-canvas text-ink-soft hover:text-ink"}`}>Could block?</button>
          <button type="button" onClick={() => toggle("evidence")} className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand ${active === "evidence" ? "bg-brand text-white" : "bg-canvas text-ink-soft hover:text-ink"}`}>Evidence</button>
        </div>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {active && (
          <motion.div
            key={active}
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-line bg-canvas/55"
          >
            <div className="p-4 sm:p-5">
              {active === "why" && (
                <div>
                  <p className="text-[13px] font-semibold">Why this matched you</p>
                  <ul className="mt-3 space-y-2">
                    {passed.map((item) => <li key={item.criterion} className="flex gap-2 text-[12px]"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /><span><strong>{item.criterion}</strong><span className="block text-ink-muted">Observed: {item.observedValue}</span></span></li>)}
                    {passed.length === 0 && <li className="text-[12px] text-ink-muted">No criteria are confirmed yet.</li>}
                  </ul>
                </div>
              )}
              {active === "block" && (
                <div>
                  <p className="text-[13px] font-semibold">What could stop this</p>
                  <ul className="mt-3 space-y-2">
                    {unresolved.map((item) => <li key={item.criterion} className="flex gap-2 text-[12px]"><HelpCircle size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" /><span><strong>{item.criterion}</strong><span className="block text-ink-muted">Still unresolved. Required: {item.expectedValue}</span></span></li>)}
                    {failed.map((item) => <li key={item.criterion} className="flex gap-2 text-[12px]"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" /><span><strong>{item.criterion}</strong><span className="block text-ink-muted">Known mismatch: {item.observedValue}</span></span></li>)}
                    {unresolved.length === 0 && failed.length === 0 && <li className="flex gap-2 text-[12px]"><CheckCircle2 size={15} className="text-success" aria-hidden="true" />No known blockers in the available facts.</li>}
                  </ul>
                </div>
              )}
              {active === "evidence" && (
                <div>
                  <div className="flex items-center gap-2"><FileSearch size={16} className="text-brand" aria-hidden="true" /><p className="text-[13px] font-semibold">AI interprets. Evidence decides.</p></div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{program?.actionRoute.sourceTitle ?? "Official program requirements"}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">Verified {program?.lastVerifiedAt ?? "date unavailable"}</p>
                  {program?.officialUrl && <a href={program.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline">View official source <ExternalLink size={13} aria-hidden="true" /></a>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
