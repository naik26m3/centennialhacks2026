"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Opportunity } from "@/lib/types";
import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import { motionTokens } from "@/lib/motion/tokens";

const statusLabel: Record<Opportunity["status"], string> = {
  ready_to_pursue: "Ready to pursue",
  needs_answers: "Needs 1 answer",
  not_eligible: "Not currently eligible",
};

const statusTone: Record<Opportunity["status"], string> = {
  ready_to_pursue: "text-success bg-success-soft",
  needs_answers: "text-warning bg-warning-soft",
  not_eligible: "text-ink-muted bg-canvas",
};

export function OpportunityRow({ opportunity }: { opportunity: Opportunity }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.992 }}
      transition={motionTokens.springSoft}
    >
      <Link
        href={`/opportunity/${opportunity.id}`}
        className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-card p-4 hover:border-line-strong hover:shadow-[0_10px_28px_rgba(23,23,26,0.05)] transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <div className="min-w-0">
          <p className="text-[15px] font-medium truncate">{opportunity.title}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[13px] text-ink-soft tabular-nums">
              Up to ${opportunity.estimatedIncentive.toLocaleString("en-CA")}
            </span>
            <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${statusTone[opportunity.status]}`}>
              {statusLabel[opportunity.status]}
            </span>
          </div>
          <div className="mt-2">
            <ConfidenceIndicator confidence={opportunity.eligibilityConfidence} />
          </div>
        </div>
        <ArrowRight
          size={18}
          className="text-ink-muted shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
}
