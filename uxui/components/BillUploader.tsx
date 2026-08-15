"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Loader2, Upload } from "lucide-react";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { HouseholdProfile, Opportunity, UtilityBillExtraction } from "@/lib/types";

interface AnalyzeResponse {
  mode: "live" | "demo";
  fallbackReason?: string;
  bill: UtilityBillExtraction;
  household: HouseholdProfile;
  opportunities: Opportunity[];
}

export function BillUploader() {
  const router = useRouter();
  const { startDemo, startFromAnalysis } = useGreenlight();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToDemo = () => {
    startDemo();
    router.push("/analyze");
  };

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      if (!res.ok) throw new Error(`Analysis request failed (${res.status})`);
      const result: AnalyzeResponse = await res.json();
      startFromAnalysis(result.bill, result.household, result.opportunities, result.mode === "live");
      router.push("/analyze");
    } catch {
      setError("Couldn't analyze that file — try again, or try the demo household below.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isAnalyzing}
        className="w-full rounded-xl border-2 border-dashed border-line-strong hover:border-brand hover:bg-brand-soft transition-colors p-8 flex flex-col items-center gap-3 text-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
          {isAnalyzing ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Upload size={20} aria-hidden="true" />}
        </span>
        <span className="text-[15px] font-medium">{isAnalyzing ? "Analyzing your bill…" : "Upload a bill"}</span>
        <span className="text-[13px] text-ink-muted">PDF, PNG, or JPG</span>
        {fileName && !isAnalyzing && <span className="text-[12px] text-brand">{fileName}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setFileName(f.name);
            analyzeFile(f);
          }
        }}
      />
      {error && <p className="text-[12px] text-danger mt-2">{error}</p>}
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <button
          onClick={goToDemo}
          disabled={isAnalyzing}
          className="flex-1 rounded-lg bg-ink text-white text-[14px] font-medium py-2.5 hover:bg-ink/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Try a demo household
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isAnalyzing}
          className="flex-1 rounded-lg border border-line text-[14px] font-medium py-2.5 hover:bg-card transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Camera size={15} aria-hidden="true" />
          Take a photo
        </button>
      </div>
    </div>
  );
}
