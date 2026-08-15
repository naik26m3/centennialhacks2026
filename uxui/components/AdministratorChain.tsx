"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ActionRoute } from "@/lib/types";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

export function AdministratorChain({ route }: { route: ActionRoute }) {
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();
  const playedVerified = useRef(false);
  const steps = [
    { label: "Funding authority", value: "Government of Ontario" },
    { label: "Program owner", value: "Home Renovation Savings program" },
    { label: "Administrator", value: route.administeringOrganization },
    { label: "Application method", value: route.preferredSubmissionMethod ?? route.routeType.replace("_", " ") },
    { label: "Verified destination", value: route.verified ? "Confirmed" : "Not verified", verified: route.verified },
  ];

  useEffect(() => {
    if (!route.verified || playedVerified.current) return;
    const timer = window.setTimeout(() => {
      playedVerified.current = true;
      play("verified");
    }, shouldReduceMotion ? 0 : 680);
    return () => window.clearTimeout(timer);
  }, [play, route.verified, shouldReduceMotion]);

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <p className="mb-4 text-[13px] font-semibold">Let&apos;s find who actually owns this.</p>
      <ul className="flex flex-col">
        {steps.map((step, index) => {
          const isVerified = "verified" in step && step.verified;
          const delay = shouldReduceMotion ? 0 : index * 0.13;
          return (
            <motion.li
              key={step.label}
              className={`relative pl-6 pb-4 last:pb-0 ${isVerified ? "rounded-md" : ""}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                boxShadow: isVerified ? "0 0 24px rgba(31, 122, 77, 0.12)" : "0 0 0 rgba(31, 122, 77, 0)",
              }}
              transition={{ duration: motionTokens.duration.standard, delay, ease: motionTokens.easeOut }}
            >
              {index < steps.length - 1 && (
                <motion.span
                  className="absolute left-[7px] top-4 bottom-0 w-px bg-line origin-top"
                  initial={shouldReduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: motionTokens.duration.standard, delay: delay + 0.08, ease: motionTokens.easeOut }}
                  aria-hidden="true"
                />
              )}
              <span
                className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 ${
                  isVerified ? "bg-success border-success shadow-[0_0_12px_rgba(31,122,77,0.35)]" : "bg-card border-line-strong"
                }`}
                aria-hidden="true"
              />
              <p className="text-[11px] font-medium text-ink-muted">{step.label}</p>
              <p className="text-[14px] font-medium">{step.value}</p>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
