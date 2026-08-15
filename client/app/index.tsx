import { Platform } from "react-native";
import { Redirect } from "expo-router";

// Platform gate. Browsers get the desktop tree, phones get the mobile one, so
// each can be laid out deliberately rather than sharing one responsive
// compromise (brief §27: "design both intentionally").
//
// Both trees stay reachable on either platform — visiting /mobile in a desktop
// browser renders the phone layout, which is handy for demoing side by side.
export default function Index() {
  return <Redirect href={Platform.OS === "web" ? "/web" : "/mobile"} />;
}
