import { AmbientBackground } from "@/components/AmbientBackground";
import { BillUploader } from "@/components/BillUploader";
import { CinematicReveal } from "@/components/motion/CinematicReveal";
import { BreathingSurface } from "@/components/motion/BreathingSurface";

export default function Home() {
  return (
    <div className="relative isolate min-h-[100svh] flex-1 overflow-hidden px-4 pb-8 pt-28 sm:px-6 sm:pb-10 sm:pt-32">
      <AmbientBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <CinematicReveal className="flex w-full flex-col items-center">
          <h1 className="max-w-4xl text-balance text-[clamp(2.65rem,6vw,5rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#173d2a] drop-shadow-[0_2px_18px_rgba(250,249,245,0.45)]">
            Find what your home is already eligible for.
          </h1>
          <p className="mt-5 max-w-2xl text-balance text-[15px] leading-relaxed text-[#284a38]/80 sm:mt-6 sm:text-[18px]">
            Upload your utility bills. Greenlight finds the verified incentives, calculates the value, and prepares the next step.
          </p>
        </CinematicReveal>

        <BreathingSurface className="mt-7 w-full sm:mt-9">
          <BillUploader />
        </BreathingSurface>

        <p className="mt-4 max-w-md text-balance text-[12px] leading-relaxed text-[#264635]/70 drop-shadow-[0_1px_10px_rgba(250,249,245,0.7)] sm:text-[13px]">
          Nothing is submitted and nobody is contacted without your approval.
        </p>
      </div>
    </div>
  );
}
