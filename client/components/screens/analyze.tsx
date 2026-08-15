import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SiteHeader } from "@/components/site-header";
import { Text } from "@/components/ui/text";
import { ANALYSIS_STEPS } from "@/lib/fixtures";
import { apiBaseUrl, createCase, getHealth } from "@/lib/api";
import { route, type Variant } from "@/lib/nav";

// Scene 2 (brief §9): a fast, deterministic analysis sequence — 2–3 seconds,
// and explicitly not a fake long "AI thinking" animation.
//
// This is also where the client talks to the backend for real. `/api/health` is
// open, so it always tells us whether the API is up. Case creation needs a Clerk
// session the client does not have yet, so a 401 is expected and downgrades to
// the fixture path rather than failing the demo.
const STEP_MS = 260;

type Link = { state: "checking" | "live" | "demo"; detail?: string };

export function AnalyzeScreen({ variant }: { variant: Variant }) {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const [visible, setVisible] = useState(1);
  const [link, setLink] = useState<Link>({ state: "checking" });
  const reducedMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reducedMotion.current = enabled;
      if (enabled) setVisible(ANALYSIS_STEPS.length);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const health = await getHealth();
      if (cancelled) return;

      if (!health.ok) {
        setLink({ state: "demo", detail: `Backend unreachable at ${apiBaseUrl()} — showing the sample household.` });
        return;
      }

      const created = await createCase();
      if (cancelled) return;

      if (created.ok) {
        setLink({ state: "live", detail: `Case ${created.data.id} · ${created.data.executionMode} mode` });
      } else if (created.error.code === "unauthenticated") {
        setLink({ state: "demo", detail: "Backend is up, but sign-in is required to create a case — showing the sample household." });
      } else {
        setLink({ state: "demo", detail: created.error.message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (visible >= ANALYSIS_STEPS.length) {
      const done = setTimeout(() => router.replace(route(variant, "/opportunities")), 500);
      return () => clearTimeout(done);
    }
    const timer = setTimeout(() => setVisible((n) => n + 1), reducedMotion.current ? 0 : STEP_MS);
    return () => clearTimeout(timer);
  }, [visible, router, variant]);

  return (
    <View className="flex-1 bg-canvas">
      <SiteHeader variant={variant} />

      <View className={variant === "web" ? "px-6 py-10" : "px-4 py-6"}>
        <View className="mx-auto w-full max-w-2xl gap-2">
          <Text className="text-xl font-medium text-ink mb-2">Analyzing</Text>
          <Text className="text-[13px] text-ink-muted mb-3">
            {name ? `Reading ${name}` : "Reading sample household document"}
          </Text>

          {ANALYSIS_STEPS.slice(0, visible).map((step, index) => (
            <View key={step} className="flex-row items-center gap-3 py-1.5">
              <Text className={index === visible - 1 ? "text-ink-muted" : "text-success"}>
                {index === visible - 1 ? "◦" : "✓"}
              </Text>
              <Text className="text-[15px] text-ink flex-1">{step}</Text>
            </View>
          ))}

          {/* Never claim a live analysis we did not perform (brief §11). */}
          {link.state !== "checking" && link.detail && (
            <View className="mt-4 rounded-lg border border-line bg-card p-3">
              <Text className={`text-[12px] ${link.state === "live" ? "text-success" : "text-ink-muted"}`}>
                {link.state === "live" ? "Connected to backend" : "Demo data"}
              </Text>
              <Text className="mt-1 text-[12px] leading-relaxed text-ink-muted">{link.detail}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
