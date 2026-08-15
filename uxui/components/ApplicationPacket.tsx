"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ApplicationField } from "@/lib/types";
import { motionTokens } from "@/lib/motion/tokens";

export function ApplicationPacket({ fields }: { fields: ApplicationField[] }) {
  const shouldReduceMotion = useReducedMotion();
  const complete = fields.filter((field) => field.source !== "missing").length;

  return (
    <motion.div
      className="rounded-lg border border-line bg-card p-4"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.duration.standard, delay: shouldReduceMotion ? 0 : 0.32, ease: motionTokens.easeOut }}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="text-[14px] font-medium">Application ready for review</p>
        <span className="text-[13px] text-ink-muted tabular-nums shrink-0">{complete} / {fields.length} fields complete</span>
      </div>
      <dl className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <motion.div
            key={field.key}
            className="flex items-center justify-between gap-4 text-[13px]"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: motionTokens.duration.fast,
              delay: shouldReduceMotion ? 0 : 0.44 + index * 0.08,
              ease: motionTokens.easeOut,
            }}
          >
            <dt className="text-ink-muted">{field.label}</dt>
            <dd className={`text-right ${field.source === "missing" ? "text-warning" : "text-ink"}`}>
              {field.value || "Needs your input"}
            </dd>
          </motion.div>
        ))}
      </dl>
    </motion.div>
  );
}
