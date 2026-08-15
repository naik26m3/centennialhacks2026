"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, StepBack } from "lucide-react";
import { useGreenlight } from "@/lib/context/greenlight-context";

export function PresentationControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { presentationMode, setPresentationMode, reset } = useGreenlight();
  const requested = searchParams.get("presentation") === "true";

  useEffect(() => {
    if (requested && !presentationMode) setPresentationMode(true);
  }, [presentationMode, requested, setPresentationMode]);

  useEffect(() => {
    if (!presentationMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        reset(true);
        router.replace("/?presentation=true");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presentationMode, reset, router]);

  if (!presentationMode && !requested) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/88 p-2 shadow-[0_18px_50px_rgba(18,45,30,0.18)] backdrop-blur-xl" aria-label="Presentation controls">
      <span className="hidden px-2 text-[11px] font-semibold text-brand sm:inline">Presentation mode</span>
      <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-medium hover:bg-canvas"><StepBack size={13} aria-hidden="true" />Restart scene</button>
      <button type="button" onClick={() => { reset(true); router.replace("/?presentation=true"); }} className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[12px] font-medium text-white hover:bg-ink/90"><RotateCcw size={13} aria-hidden="true" />Reset demo</button>
    </aside>
  );
}
