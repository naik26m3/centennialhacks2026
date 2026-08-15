"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect } from "react";
import { useFinePointer } from "@/lib/motion/use-fine-pointer";

export function AmbientBackground() {
  const shouldReduceMotion = useReducedMotion();
  const pointerReactive = useFinePointer();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 45, damping: 28, mass: 0.7 });
  const y = useSpring(rawY, { stiffness: 45, damping: 28, mass: 0.7 });

  useEffect(() => {
    if (!pointerReactive || shouldReduceMotion) return;
    const onMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth - 0.5) * -7);
      rawY.set((event.clientY / window.innerHeight - 0.5) * -5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerReactive, rawX, rawY, shouldReduceMotion]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#dce3db]" aria-hidden="true">
      <motion.div
        className="absolute -inset-3"
        style={{ x, y }}
        animate={shouldReduceMotion ? undefined : { scale: [1.02, 1.035, 1.02] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/images/greenlight-meadow.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[64%_center] sm:object-center"
        />
      </motion.div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(244,246,240,0.44)_0%,rgba(246,242,226,0.16)_52%,rgba(24,55,35,0.20)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(250,249,245,0.46),transparent_42%)]" />
      <motion.div
        className="absolute -left-[12%] top-[8%] h-[55vh] w-[60vw] rounded-full bg-[radial-gradient(circle,rgba(255,246,211,0.34),transparent_68%)] blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, 18, 0], opacity: [0.72, 0.92, 0.72] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="hero-grain absolute inset-0 opacity-[0.055] mix-blend-soft-light" />
    </div>
  );
}
