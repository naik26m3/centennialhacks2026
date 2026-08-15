import { ScrollView, useWindowDimensions, View } from "react-native";
import { AmbientBackground } from "@/components/ambient-background";
import { BillUploader } from "@/components/bill-uploader";
import { BreathingSurface } from "@/components/motion/breathing-surface";
import { CinematicReveal } from "@/components/motion/cinematic-reveal";
import { SiteHeader } from "@/components/site-header";
import { Text } from "@/components/ui/text";
import type { Variant } from "@/lib/nav";

// Ported from uxui/app/page.tsx (updated design).
//
// The web headline uses `clamp(2.65rem, 6vw, 5rem)`; React Native has no clamp,
// so the same curve is computed from the viewport width instead.
function headlineSize(width: number) {
  const preferred = width * 0.06;
  return Math.round(Math.max(42.4, Math.min(preferred, 80)));
}

export function LandingScreen({ variant }: { variant: Variant }) {
  const { width } = useWindowDimensions();
  const wide = variant === "web";
  const size = headlineSize(width);

  return (
    <View className="flex-1 bg-canvas">
      <AmbientBackground />
      <SiteHeader variant={variant} />

      <ScrollView contentContainerClassName={wide ? "px-6 pt-32 pb-10" : "px-4 pt-28 pb-8"}>
        <View className="mx-auto w-full max-w-4xl items-center">
          <CinematicReveal className="w-full items-center">
            <Text
              className="text-center font-semibold text-[#173d2a]"
              style={{ fontSize: size, lineHeight: size * 0.98, letterSpacing: size * -0.055 }}
            >
              Your home may be leaving thousands behind.
            </Text>

            <Text
              className={`mt-5 max-w-2xl text-center leading-relaxed text-[#284a38] ${wide ? "text-[18px] sm:mt-6" : "text-[15px]"}`}
            >
              Upload a bill. We expose verified incentives, show what they are worth, and prepare the
              path to claim them.
            </Text>
          </CinematicReveal>

          <BreathingSurface className={`w-full ${wide ? "mt-9" : "mt-7"}`}>
            <BillUploader variant={variant} />
          </BreathingSurface>

          <Text
            className={`mt-4 max-w-md text-center leading-relaxed text-[#264635] ${wide ? "text-[13px]" : "text-[12px]"}`}
          >
            Nothing is submitted and nobody is contacted without your approval.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
