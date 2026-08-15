"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { TenureDecisionDelta } from "@/lib/types";
import { motionTokens } from "@/lib/motion/tokens";

export function EligibilityDelta({ delta }: { delta: TenureDecisionDelta }) {
  const shouldReduceMotion = useReducedMotion();
  const positive = delta.newlyReady > 0;
  return (
    <motion.div initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionTokens.duration.standard }} className="rounded-2xl border border-brand/20 bg-brand-soft/70 p-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-brand">Your answer changed the result</div>
      <div className="mt-3 flex items-center gap-3 text-[14px]"><span className="rounded-lg bg-card px-2.5 py-1.5 capitalize text-ink-muted">{delta.from}</span><ArrowRight size={15} className="text-brand" aria-hidden="true" /><span className="rounded-lg bg-card px-2.5 py-1.5 font-semibold capitalize">{delta.to}</span></div>
      <div className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-soft">{positive ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> : <XCircle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />}<span>{positive ? `${delta.newlyReady} opportunity${delta.newlyReady === 1 ? " is" : " are"} now ready to pursue.` : `${delta.newlyBlocked} opportunity${delta.newlyBlocked === 1 ? " now requires" : " now require"} owner participation.`}</span></div>
    </motion.div>
  );
}
