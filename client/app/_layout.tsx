import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

// Root of both platform trees. Chrome lives in SiteHeader inside each screen
// (ported from uxui/app/layout.tsx), so the navigator header stays off.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#faf9f5" } }} />
    </SafeAreaProvider>
  );
}
