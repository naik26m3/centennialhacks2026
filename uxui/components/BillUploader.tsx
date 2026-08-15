"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { HouseholdProfile, Opportunity, UtilityBillExtraction } from "@/lib/types";
import { TactileButton } from "@/components/motion/TactileButton";
import { CinematicReveal } from "@/components/motion/CinematicReveal";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

interface AnalyzeResponse {
  mode: "live" | "demo";
  fallbackReason?: string;
  bills: UtilityBillExtraction[];
  household: HouseholdProfile;
  opportunities: Opportunity[];
}

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

// The actual work behind /api/analyze happens in this order (bill extraction,
// then eligibility reasoning), and each real Gemini call can run 10-20s on
// its own — so this cycles roughly in step with the real request instead of
// just showing a spinner for up to 30s straight, which reads as frozen.
const ANALYSIS_STEPS = ["Reading your bills", "Extracting usage and provider details", "Matching against incentive programs", "Checking eligibility"];
const ANALYSIS_STEP_INTERVAL_MS = 6000;
// Backstop above the server's own bounded Gemini timeout/retry budget
// (~54s worst case per call, two sequential calls per analysis — see
// REQUEST_HTTP_OPTIONS in lib/ai/gemini.ts) so a truly stuck request still
// resolves client-side instead of waiting forever.
const CLIENT_FETCH_TIMEOUT_MS = 120000;

export function BillUploader() {
  const router = useRouter();
  const { startDemo, startFromAnalysis } = useGreenlight();
  const { play } = useGreenlightAudio();
  const shouldReduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // stepIndex resets when analysis *starts* (in analyzeFiles below, already
  // an event handler) — not here. The step panel only renders while
  // isAnalyzing is true anyway, so there's nothing to reset once it ends.
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, ANALYSIS_STEPS.length - 1));
    }, ANALYSIS_STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Each time the active step advances, a quiet tick — the audible half of
  // the same progress the checklist shows visually.
  useEffect(() => {
    if (!isAnalyzing) return;
    play("step");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fire on stepIndex advancing, not on `play` identity or isAnalyzing re-checks
  }, [stepIndex]);

  // Takes an already-materialized array, not a live FileList — a FileList
  // read from input.files is a live view of the input, so clearing the input
  // right after reading it (below, to allow re-selecting the same file) also
  // empties that same FileList out from under any deferred/batched state
  // updater that still references it.
  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    play("upload");
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map(fileKey));
      const next = files.filter((f) => !existingKeys.has(fileKey(f)));
      return [...prev, ...next];
    });
  };

  const removeFile = (key: string) => {
    setSelectedFiles((prev) => prev.filter((f) => fileKey(f) !== key));
  };

  const goToDemo = () => {
    startDemo();
    router.push("/analyze");
  };

  const analyzeFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsAnalyzing(true);
    setStepIndex(0);
    setError(null);
    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Analysis request failed (${res.status})`);
      const result: AnalyzeResponse = await res.json();
      startFromAnalysis(result.bills, result.household, result.opportunities, result.mode === "live");
      router.push("/analyze");
    } catch (err) {
      play("error");
      setError(
        err instanceof DOMException && err.name === "TimeoutError"
          ? "That is taking much longer than expected. Try again or use the demo household below."
          : "We could not analyze those files. Try again or use the demo household below."
      );
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-white/80 bg-white/72 p-3 shadow-[0_24px_70px_rgba(32,57,40,0.20)] backdrop-blur-2xl sm:p-4">
      {isAnalyzing ? (
        <div className="relative w-full overflow-hidden rounded-[20px] border border-white/80 bg-white/48 px-5 py-6 text-left sm:px-8 sm:py-7" aria-live="polite">
          <motion.span
            className="pointer-events-none absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-[#f9efc7]/65 to-transparent blur-xl"
            animate={shouldReduceMotion ? undefined : { x: ["-180%", "720%"] }}
            transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <div className="relative mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Loader2 size={17} className="animate-spin" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-brand">Greenlight is reading the household</p>
              <p className="text-[12px] text-ink-muted">Each confirmed step narrows the right programs.</p>
            </div>
          </div>
          <ul className="relative flex w-full flex-col gap-2.5">
            {ANALYSIS_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2.5 text-[13px]">
                {i < stepIndex ? (
                  <CheckCircle2 size={15} className="text-success shrink-0" aria-hidden="true" />
                ) : i === stepIndex ? (
                  <span className="relative flex h-[15px] w-[15px] shrink-0 items-center justify-center" aria-hidden="true">
                    <span className="absolute h-full w-full rounded-full bg-brand/20 motion-safe:animate-ping" />
                    <span className="relative h-2 w-2 rounded-full bg-brand" />
                  </span>
                ) : (
                  <span className="h-[15px] w-[15px] shrink-0 rounded-full border border-brand/20" aria-hidden="true" />
                )}
                <span className={i <= stepIndex ? "text-ink" : "text-ink-muted"}>{step}</span>
              </li>
            ))}
          </ul>
          <p className="relative mt-5 text-[11px] text-ink-muted">Live document analysis usually takes 20-30 seconds.</p>
        </div>
      ) : (
        <motion.button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          whileHover={shouldReduceMotion ? undefined : { y: -2, borderColor: "var(--brand)", backgroundColor: "var(--brand-soft)" }}
          animate={{
            borderColor: isDraggingOver ? "var(--brand)" : "var(--line-strong)",
            backgroundColor: isDraggingOver ? "rgba(231, 240, 234, 0.88)" : "rgba(255, 255, 255, 0.36)",
          }}
          transition={shouldReduceMotion ? { duration: 0 } : motionTokens.springSoft}
          className="group flex min-h-[178px] w-full flex-col items-center justify-center gap-2.5 rounded-[20px] border border-dashed p-6 text-center transition-shadow hover:shadow-[inset_0_0_45px_rgba(255,255,255,0.34)] sm:min-h-[196px] sm:p-8"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand/10 bg-white/55 text-brand shadow-[0_8px_22px_rgba(31,92,63,0.08)] transition-transform group-hover:-translate-y-0.5">
            <Upload size={21} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="mt-1 text-[16px] font-semibold text-brand">
            {isDraggingOver ? "Drop it here. We will take it from here." : "Put your utility bills to work"}
          </span>
          <span className="max-w-sm text-[12.5px] leading-relaxed text-ink-soft/75">
            PDF or photo · electricity and gas bills can be added together
          </span>
        </motion.button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          addFiles(files);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          addFiles(files);
        }}
      />

      {!isAnalyzing && selectedFiles.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 px-1">
          <AnimatePresence initial={false}>
            {selectedFiles.map((f) => (
              <motion.li
                key={fileKey(f)}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: motionTokens.duration.fast }}
                className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/58 px-3 py-2 text-[13px]"
              >
                <FileText size={14} className="text-ink-muted shrink-0" aria-hidden="true" />
                <span className="truncate flex-1">{f.name}</span>
                <button
                  onClick={() => removeFile(fileKey(f))}
                  className="text-ink-muted hover:text-ink shrink-0"
                  aria-label={`Remove ${f.name}`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {error && (
        <CinematicReveal>
          <p className="text-[12px] text-danger mt-2">{error}</p>
        </CinematicReveal>
      )}

      {!isAnalyzing && (
        <div className="mt-3 flex flex-col gap-2 sm:grid sm:grid-cols-2">
          {selectedFiles.length > 0 ? (
            <TactileButton
              onClick={analyzeFiles}
              className="rounded-xl bg-brand py-3 text-[14px] font-semibold text-white shadow-[0_9px_24px_rgba(31,92,63,0.20)] transition-colors hover:bg-[#174c33]"
            >
              {`Analyze ${selectedFiles.length} bill${selectedFiles.length === 1 ? "" : "s"}`}
            </TactileButton>
          ) : (
            <TactileButton
              onClick={goToDemo}
              className="rounded-xl bg-brand py-3 text-[14px] font-semibold text-white shadow-[0_9px_24px_rgba(31,92,63,0.20)] transition-colors hover:bg-[#174c33]"
            >
              Reveal a demo household
            </TactileButton>
          )}
          <TactileButton
            onClick={() => cameraInputRef.current?.click()}
            playSound={false}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/90 bg-white/38 py-3 text-[14px] font-semibold text-brand transition-colors hover:bg-white/68"
          >
            <Camera size={15} aria-hidden="true" />
            Take a photo
          </TactileButton>
        </div>
      )}
      {!isAnalyzing && selectedFiles.length > 0 && (
        <button
          onClick={goToDemo}
          className="mt-2 w-full text-center text-[12px] text-ink-muted hover:text-ink transition-colors"
        >
          Or try a demo household instead
        </button>
      )}
    </div>
  );
}
