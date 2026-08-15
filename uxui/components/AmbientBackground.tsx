"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useFinePointer } from "@/lib/motion/use-fine-pointer";

// The color-based substitute for the spec's photographed parallax layers
// (§5/§6) — this app has no hero photography, so "environmental life" comes
// from two very slowly drifting soft gradient fields in the existing brand
// palette instead. Pointer micro-parallax is desktop/fine-pointer only and
// fully disabled under reduced motion.
export function AmbientBackground() {
  const shouldReduceMotion = useReducedMotion();
  const [pointerOffset, setPointerOffset] = useState({ x: 0, y: 0 });
  const pointerReactive = useFinePointer();

  useEffect(() => {
    if (!pointerReactive || shouldReduceMotion) return;
    const onMove = (e: PointerEvent) => {
      setPointerOffset({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerReactive, shouldReduceMotion]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10" aria-hidden="true">
      <div
        className="absolute inset-0 transition-transform duration-500 ease-out"
        style={{ transform: `translate(${pointerOffset.x * 6}px, ${pointerOffset.y * 6}px)` }}
      >
        <motion.div
          className="absolute -top-[20%] -left-[15%] h-[65vh] w-[65vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--brand-soft) 0%, transparent 70%)" }}
          animate={shouldReduceMotion ? undefined : { x: [0, 24, -12, 0], y: [0, -18, 14, 0], scale: [1, 1.05, 0.98, 1] }}
          transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-[25%] -right-[10%] h-[60vh] w-[60vh] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--success-soft) 0%, transparent 70%)" }}
          animate={shouldReduceMotion ? undefined : { x: [0, -20, 16, 0], y: [0, 16, -10, 0], scale: [1, 0.97, 1.04, 1] }}
          transition={{ duration: 50, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
