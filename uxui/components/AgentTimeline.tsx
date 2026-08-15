"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, CircleDashed, HelpCircle, XCircle } from "lucide-react";
import { AgentEvent } from "@/lib/types";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

function EventIcon({ status }: { status: AgentEvent["status"] }) {
  if (status === "complete") return <CheckCircle2 size={16} className="text-success" aria-hidden="true" />;
  if (status === "in_progress") return <CircleDashed size={16} className="text-ink-muted animate-spin" aria-hidden="true" />;
  if (status === "needs_human") return <HelpCircle size={16} className="text-warning" aria-hidden="true" />;
  return <XCircle size={16} className="text-danger" aria-hidden="true" />;
}

export function AgentTimeline({ events }: { events: AgentEvent[] }) {
  const shouldReduceMotion = useReducedMotion();
  const { play } = useGreenlightAudio();
  const [visibleCount, setVisibleCount] = useState(0);
  const renderedCount = shouldReduceMotion ? events.length : visibleCount;
  const visibleEvents = events.slice(0, renderedCount);
  const groups = Array.from(new Set(visibleEvents.map((event) => event.group)));

  useEffect(() => {
    if (shouldReduceMotion || visibleCount >= events.length) return;
    const timer = window.setTimeout(() => {
      const nextIndex = visibleCount;
      play("step", { gainScale: Math.max(0.42, 0.92 - nextIndex * 0.055) });
      setVisibleCount((count) => Math.min(count + 1, events.length));
    }, visibleCount === 0 ? 120 : 105);
    return () => window.clearTimeout(timer);
  }, [events.length, play, shouldReduceMotion, visibleCount]);

  return (
    <div className="flex flex-col gap-5" aria-label="Agent progress">
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <motion.div
            key={group}
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: motionTokens.duration.fast }}
          >
            <p className="text-[12px] font-medium text-ink-muted uppercase tracking-wide mb-2">{group}</p>
            <ul className="flex flex-col gap-2">
              {visibleEvents.filter((event) => event.group === group).map((event) => (
                <motion.li
                  key={event.id}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: -8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easeOut }}
                  className="flex items-center gap-2.5 text-[14px]"
                >
                  <EventIcon status={event.status} />
                  <span className={event.status === "blocked" ? "text-ink-muted" : "text-ink"}>{event.title}</span>
                  {event.detail && <span className="text-[12px] text-warning">{event.detail}</span>}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
