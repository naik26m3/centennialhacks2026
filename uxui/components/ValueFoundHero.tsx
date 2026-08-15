"use client";

import { useEffect, useState } from "react";

export function ValueFoundHero({ total, opportunityCount }: { total: number; opportunityCount: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(total * progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <div className="rounded-2xl bg-card border border-line p-8 text-center">
      <p className="text-[13px] text-ink-muted mb-2">We found</p>
      <p className="text-5xl sm:text-6xl font-medium tabular-nums text-success tracking-tight">
        ${display.toLocaleString("en-CA")}
      </p>
      <p className="text-[14px] text-ink-soft mt-2">potential value found</p>
      <p className="text-[13px] text-ink-muted mt-4">
        {opportunityCount} opportunities appear worth pursuing
      </p>
    </div>
  );
}
