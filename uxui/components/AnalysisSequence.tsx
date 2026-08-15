"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useGreenlight } from "@/lib/context/greenlight-context";

const STEPS = [
  "Reading document",
  "Toronto, Ontario",
  "Residential gas account · Enbridge Gas detected",
  "Billing structure detected",
  "Potential efficiency opportunity detected",
  "Building household profile",
  "Searching programs",
  "Resolving administrators and required actions",
];

export function AnalysisSequence() {
  const router = useRouter();
  const { bill, household, hydrated } = useGreenlight();
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!bill || !household) {
      router.replace("/");
      return;
    }
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= STEPS.length) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 280);
    return () => clearInterval(interval);
  }, [hydrated, bill, household, router]);

  useEffect(() => {
    if (visibleCount >= STEPS.length) {
      const t = setTimeout(() => router.push("/opportunities"), 500);
      return () => clearTimeout(t);
    }
  }, [visibleCount, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <ul className="flex flex-col gap-3">
          <AnimatePresence>
            {STEPS.slice(0, visibleCount).map((step, i) => (
              <motion.li
                key={step}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-3 text-[14px]"
              >
                <CheckCircle2 size={16} className="text-success shrink-0" aria-hidden="true" />
                <span className={i === visibleCount - 1 ? "text-ink" : "text-ink-soft"}>{step}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}
