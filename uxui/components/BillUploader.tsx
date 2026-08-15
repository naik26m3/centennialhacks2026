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
          ? "That's taking much longer than expected — try again, or try the demo household below."
          : "Couldn't analyze those files — try again, or try the demo household below."
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
    <div className="w-full max-w-md">
      {isAnalyzing ? (
        <div className="w-full rounded-xl border-2 border-dashed border-line-strong p-8 flex flex-col items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          </span>
          <ul className="flex flex-col gap-2 w-full max-w-[240px]">
            {ANALYSIS_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2 text-[13px]">
                {i < stepIndex ? (
                  <CheckCircle2 size={14} className="text-success shrink-0" aria-hidden="true" />
                ) : i === stepIndex ? (
                  <Loader2 size={14} className="animate-spin text-brand shrink-0" aria-hidden="true" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-line shrink-0" aria-hidden="true" />
                )}
                <span className={i <= stepIndex ? "text-ink" : "text-ink-muted"}>{step}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-muted text-center">Real Gemini analysis can take 20–30 seconds.</p>
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
            backgroundColor: isDraggingOver ? "var(--brand-soft)" : "var(--card)",
          }}
          transition={shouldReduceMotion ? { duration: 0 } : motionTokens.springSoft}
          className="w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 text-center"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Upload size={20} aria-hidden="true" />
          </span>
          <span className="text-[15px] font-medium">
            {isDraggingOver ? "Drop it here — we'll take it from here" : "Upload your bills"}
          </span>
          <span className="text-[13px] text-ink-muted max-w-xs">
            Add your electricity and gas bills — a few months of each gives more accurate savings estimates.
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
        <ul className="mt-3 flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {selectedFiles.map((f) => (
              <motion.li
                key={fileKey(f)}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: motionTokens.duration.fast }}
                className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-[13px]"
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
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {selectedFiles.length > 0 ? (
            <TactileButton
              onClick={analyzeFiles}
              className="flex-1 rounded-lg bg-ink text-white text-[14px] font-medium py-2.5 hover:bg-ink/90 transition-colors"
            >
              {`Analyze ${selectedFiles.length} bill${selectedFiles.length === 1 ? "" : "s"}`}
            </TactileButton>
          ) : (
            <TactileButton
              onClick={goToDemo}
              className="flex-1 rounded-lg bg-ink text-white text-[14px] font-medium py-2.5 hover:bg-ink/90 transition-colors"
            >
              Try a demo household
            </TactileButton>
          )}
          <TactileButton
            onClick={() => cameraInputRef.current?.click()}
            playSound={false}
            className="flex-1 rounded-lg border border-line text-[14px] font-medium py-2.5 hover:bg-card transition-colors inline-flex items-center justify-center gap-2"
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
