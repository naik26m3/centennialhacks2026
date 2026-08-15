"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownToLine, Banknote, Layers3, TrendingUp } from "lucide-react";
import { OptimizationObjective } from "@/lib/types";
import { OBJECTIVES } from "@/lib/experience";
import { TactileButton } from "@/components/motion/TactileButton";
import { motionTokens } from "@/lib/motion/tokens";

const icons = {
  max_value: Banknote,
  min_upfront: ArrowDownToLine,
  all_eligible: Layers3,
  long_term_savings: TrendingUp,
};

export function ObjectiveSelector({
  sourceLabel,
  onSelect,
  onBack,
}: {
  sourceLabel: string;
  onSelect: (objective: OptimizationObjective) => void;
  onBack: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={motionTokens.springSoft}
      className="rounded-[20px] border border-white/80 bg-white/52 p-4 text-left sm:p-6"
    >
      <p className="text-[12px] font-medium text-brand/70">{sourceLabel}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-brand">Before I look, what matters most?</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">This choice changes the ranking and the plan Greenlight builds.</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {OBJECTIVES.map((objective, index) => {
          const Icon = icons[objective.id];
          return (
            <motion.div
              key={objective.id}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.duration.standard, delay: shouldReduceMotion ? 0 : index * 0.055 }}
            >
              <TactileButton
                onClick={() => onSelect(objective.id)}
                className="flex h-full min-h-[92px] w-full items-start gap-3 rounded-xl border border-brand/15 bg-white/58 p-3.5 text-left transition-colors hover:border-brand/40 hover:bg-white/86 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Icon size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <span className="block text-[13px] font-semibold leading-snug text-ink">{objective.label}</span>
                  <span className="mt-1 block text-[11.5px] leading-relaxed text-ink-muted">{objective.detail}</span>
                </span>
              </TactileButton>
            </motion.div>
          );
        })}
      </div>
      <button type="button" onClick={onBack} className="mt-4 text-[12px] font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Choose a different bill
      </button>
    </motion.div>
  );
}
