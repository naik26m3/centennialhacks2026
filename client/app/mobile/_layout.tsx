import { Stack } from "expo-router";

// Headers are drawn by SiteHeader inside each screen (ported from uxui), so the
// navigator's own header is turned off here.
export default function MobileLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#faf9f5" } }} />;
}
