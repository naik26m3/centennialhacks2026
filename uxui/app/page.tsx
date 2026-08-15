import { BillUploader } from "@/components/BillUploader";
import { AmbientBackground } from "@/components/AmbientBackground";
import { BreathingSurface } from "@/components/motion/BreathingSurface";

export default function Home() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-20">
      <AmbientBackground />
      <BreathingSurface className="w-full max-w-2xl flex flex-col items-center text-center gap-6">
        <p className="text-[13px] uppercase tracking-wide text-brand font-medium">
          Your personal sustainability negotiator
        </p>
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight leading-[1.1]">
          What are you leaving on the table?
        </h1>
        <p className="text-[16px] sm:text-[17px] text-ink-soft max-w-lg leading-relaxed">
          Upload a utility bill. Greenlight finds relevant incentives, calculates the
          economics, figures out who actually handles the next step, and prepares the
          work required to pursue it.
        </p>
        <BillUploader />
        <p className="text-[13px] text-ink-muted max-w-sm">
          We never submit anything or contact anyone without your approval.
        </p>
      </BreathingSurface>
    </div>
  );
}
