"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ChevronDown, CircleDashed, HelpCircle, XCircle } from "lucide-react";
import { AgentEvent } from "@/lib/types";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

function EventIcon({ status }: { status: AgentEvent["status"] }) {
  if (status === "complete") return <CheckCircle2 size={16} className="text-success" aria-hidden="true" />;
  if (status === "in_progress") return <CircleDashed size={16} className="animate-spin text-ink-muted" aria-hidden="true" />;
  if (status === "needs_human") return <HelpCircle size={16} className="text-warning" aria-hidden="true" />;
  return <XCircle size={16} className="text-danger" aria-hidden="true" />;
}

export function AgentTimeline({ events }: { events: AgentEvent[] }) {
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();
  const humanIndex = events.findIndex((event) => event.status === "needs_human");
  const executableEvents = humanIndex >= 0 ? events.slice(0, humanIndex + 1) : events;
  const [visibleCount, setVisibleCount] = useState(shouldReduceMotion ? executableEvents.length : 0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const visibleEvents = executableEvents.slice(0, shouldReduceMotion ? executableEvents.length : visibleCount);

  useEffect(() => {
    if (shouldReduceMotion || visibleCount >= executableEvents.length) return;
    const timer = window.setTimeout(() => {
      const nextIndex = visibleCount;
      if (nextIndex === 0 || nextIndex === executableEvents.length - 1) play("step", { gainScale: 0.52 });
      setVisibleCount((count) => Math.min(count + 1, executableEvents.length));
    }, visibleCount === 0 ? 140 : 210);
    return () => window.clearTimeout(timer);
  }, [executableEvents.length, play, shouldReduceMotion, visibleCount]);

  return (
    <div aria-label="Observable Greenlight actions">
      <p className="mb-3 text-[12px] font-medium text-ink-muted">Observable actions. Select any completed event to inspect the result.</p>
      <ol className="relative flex flex-col gap-2 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-line">
        <AnimatePresence initial={false}>
          {visibleEvents.map((event) => {
            const isExpanded = expanded === event.id;
            return (
              <motion.li
                key={event.id}
                initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easeOut }}
                className="relative rounded-xl border border-line bg-card"
              >
                <button
                  type="button"
                  onClick={() => event.detail && setExpanded(isExpanded ? null : event.id)}
                  className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  aria-expanded={event.detail ? isExpanded : undefined}
                >
                  <span className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card"><EventIcon status={event.status} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[10px] font-medium text-ink-muted">{event.group}</span><span className="block text-[13px] font-semibold">{event.title}</span></span>
                  {event.detail && <ChevronDown size={15} className={`text-ink-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />}
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && event.detail && (
                    <motion.p initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
                      {event.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}
