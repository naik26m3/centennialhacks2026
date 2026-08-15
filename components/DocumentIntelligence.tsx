"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Check, FileText, Hand, HelpCircle, MapPin, Waves } from "lucide-react";
import { HouseholdProfile, UtilityBillExtraction } from "@/lib/types";
import { motionTokens } from "@/lib/motion/tokens";

type FactKind = "known" | "inferred" | "needed" | "human";

interface Fact {
  id: string;
  label: string;
  value: string;
  kind: FactKind;
  confidence: string;
  why: string;
  icon: typeof Check;
}

const factPresentation: Record<FactKind, { symbol: string; label: string; tone: string }> = {
  known: { symbol: "✓", label: "Extracted", tone: "text-success bg-success-soft" },
  inferred: { symbol: "~", label: "Inferred", tone: "text-brand bg-brand-soft" },
  needed: { symbol: "?", label: "Still needed", tone: "text-warning bg-warning-soft" },
  human: { symbol: "!", label: "Requires you", tone: "text-ink-soft bg-canvas" },
};

export function DocumentIntelligence({
  bill,
  household,
  visibleFacts,
}: {
  bill: UtilityBillExtraction;
  household: HouseholdProfile;
  visibleFacts: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [activeFact, setActiveFact] = useState<string | null>(null);
  const usage = bill.naturalGas?.usageM3 != null
    ? `${bill.naturalGas.usageM3.toLocaleString("en-CA")} m³`
    : bill.electricity?.usageKwh != null
      ? `${bill.electricity.usageKwh.toLocaleString("en-CA")} kWh`
      : "Not detected";

  const facts: Fact[] = [
    {
      id: "provider",
      label: "Utility provider",
      value: bill.provider ?? "Not detected",
      kind: "known",
      confidence: bill.provider ? "High confidence" : "Needs verification",
      why: "Identifies provider-specific programs and confirms the household's service territory.",
      icon: Building2,
    },
    {
      id: "usage",
      label: "Billing usage",
      value: usage,
      kind: "known",
      confidence: usage === "Not detected" ? "Needs verification" : "High confidence",
      why: "Supports annualized usage estimates and the deterministic savings model.",
      icon: Waves,
    },
    {
      id: "jurisdiction",
      label: "Jurisdiction",
      value: `${household.city ?? "Unknown"}, ${household.provinceState}`,
      kind: "known",
      confidence: household.city ? "High confidence" : "Needs verification",
      why: "Determines which government and utility incentive rules can apply.",
      icon: MapPin,
    },
    {
      id: "heating",
      label: "Primary heating",
      value: household.primaryHeating.replace("_", " "),
      kind: "inferred",
      confidence: "Model interpretation",
      why: "Helps identify relevant equipment programs. Greenlight keeps this separate from directly extracted facts.",
      icon: FileText,
    },
    {
      id: "tenure",
      label: "Property tenure",
      value: household.tenure === "unknown" ? "Unresolved" : household.tenure,
      kind: household.tenure === "unknown" ? "needed" : "known",
      confidence: household.tenure === "unknown" ? "Not present on the bill" : "Human confirmed",
      why: "Some programs require owner participation. Greenlight asks instead of guessing.",
      icon: HelpCircle,
    },
    {
      id: "declaration",
      label: "Legal declaration",
      value: "Requires applicant",
      kind: "human",
      confidence: "Never inferred",
      why: "Greenlight will prepare the field but will never sign or certify a declaration for you.",
      icon: Hand,
    },
  ];

  return (
    <div className="grid w-full gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-start">
      <motion.article
        initial={shouldReduceMotion ? false : { opacity: 0, x: -18, rotate: -0.8 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easeOut }}
        className="relative overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-[0_22px_55px_rgba(39,58,45,0.10)] sm:p-7"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Utility statement</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{bill.provider ?? "Utility provider"}</h2>
          </div>
          <FileText size={24} className="text-brand/60" aria-hidden="true" />
        </div>
        <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-7">
          <div><dt className="text-[11px] text-ink-muted">Billing period</dt><dd className="mt-1 text-[13px] font-medium">{bill.billingPeriod.start ?? "Unknown"}<br />to {bill.billingPeriod.end ?? "Unknown"}</dd></div>
          <div><dt className="text-[11px] text-ink-muted">Amount</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{bill.totalAmount == null ? "Unknown" : `$${bill.totalAmount.toFixed(2)}`}</dd></div>
          <div><dt className="text-[11px] text-ink-muted">Usage</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{usage}</dd></div>
          <div><dt className="text-[11px] text-ink-muted">Account</dt><dd className="mt-1 text-[13px] font-medium capitalize">{bill.accountType}</dd></div>
        </dl>
        <div className="mt-9 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-muted">
          Demo mode uses a synthetic household. Live uploads are labeled separately and validated before calculations run.
        </div>
      </motion.article>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-[13px] font-semibold">What Greenlight understands</p>
          <p className="text-[11px] text-ink-muted">Tap any fact</p>
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {facts.slice(0, shouldReduceMotion ? facts.length : visibleFacts).map((fact) => {
              const presentation = factPresentation[fact.kind];
              const isActive = activeFact === fact.id;
              const Icon = fact.icon;
              return (
                <motion.button
                  type="button"
                  key={fact.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setActiveFact(isActive ? null : fact.id)}
                  className="rounded-xl border border-line bg-card p-3.5 text-left transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  aria-expanded={isActive}
                >
                  <span className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${presentation.tone}`}><Icon size={15} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] text-ink-muted">{fact.label}</span>
                      <span className="block truncate text-[14px] font-semibold capitalize">{fact.value}</span>
                    </span>
                    <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${presentation.tone}`}>{presentation.symbol} {presentation.label}</span>
                  </span>
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.span
                        initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 block border-t border-line pt-3"
                      >
                        <span className="block text-[11px] font-medium text-brand">{fact.confidence}</span>
                        <span className="mt-1 block text-[12px] leading-relaxed text-ink-soft">{fact.why}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
