import { Pressable, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Leaf } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { SoundToggle } from "@/components/sound-toggle";
import { route, type Variant } from "@/lib/nav";

// Ported from uxui/components/SiteHeader.tsx (updated design).
//
// Two modes, as on web:
//   home  — a floating translucent pill over the ambient background
//   rest  — a plain bar with a bottom border
//
// The web build gets its translucency from `backdrop-blur-2xl`, which React
// Native has no equivalent for on a plain View; a high-opacity white fill is
// used instead so the pill still reads as glass over the meadow image.
export function SiteHeader({ variant }: { variant: Variant }) {
  const router = useRouter();
  const pathname = usePathname();
  const wide = variant === "web";
  const isHome = pathname === `/${variant}` || pathname === `/${variant}/`;

  return (
    <View
      className={
        isHome
          ? "absolute inset-x-0 top-0 z-30 px-4 pt-4 sm:pt-6"
          : "z-30 border-b border-line bg-canvas"
      }
    >
      <View
        className={`mx-auto w-full flex-row items-center justify-between px-4 ${
          isHome
            ? "h-16 max-w-5xl rounded-full border border-white/70 bg-white/80"
            : "h-14 max-w-6xl"
        }`}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Greenlight home"
          onPress={() => router.push(route(variant, "/"))}
          className="flex-row items-center gap-2.5"
        >
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-brand">
            <Leaf size={15} color="#ffffff" />
          </View>
          <Text className={`text-[15px] font-semibold ${isHome ? "text-brand" : "text-ink"}`}>
            Greenlight
          </Text>
        </Pressable>

        {/* uxui hides these below `sm`; mobile keeps the wordmark only. */}
        <View className="flex-row items-center gap-2 sm:gap-5">
        {wide && (
          <View className="flex-row items-center gap-7">
            <Pressable accessibilityRole="link" onPress={() => router.push(route(variant, "/opportunities"))}>
              <Text className={`text-sm ${isHome ? "text-brand/80" : "text-ink-soft"}`}>Opportunities</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push(route(variant, "/plan"))}>
              <Text className={`text-sm ${isHome ? "text-brand/80" : "text-ink-soft"}`}>Plan</Text>
            </Pressable>
          </View>
        )}
          <SoundToggle tint={isHome ? "#1f5c3f" : "#8a897f"} />
        </View>
      </View>
    </View>
  );
}
