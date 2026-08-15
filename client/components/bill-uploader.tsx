import { useState } from "react";
import { Alert, Platform, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter, type Href } from "expo-router";
import { Camera, FileText, Upload, X } from "lucide-react-native";
import { CinematicReveal } from "@/components/motion/cinematic-reveal";
import { TactileButton } from "@/components/motion/tactile-button";
import { Text } from "@/components/ui/text";
import { route, type Variant } from "@/lib/nav";

// Ported from uxui/components/BillUploader.tsx (updated design): a large glass
// drop panel, a list of selected files with remove buttons, then the CTA pair.
//
// Brief §31: choose a PDF, choose an image, or photograph a bill. Multi-select
// matters because electricity and gas bills are usually separate documents.
const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

interface PickedFile {
  key: string;
  name: string;
  uri: string;
  mimeType: string;
}

export function BillUploader({ variant }: { variant: Variant }) {
  const router = useRouter();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addFiles(next: PickedFile[]) {
    setFiles((current) => {
      const seen = new Set(current.map((f) => f.key));
      return [...current, ...next.filter((f) => !seen.has(f.key))];
    });
  }

  async function pickDocuments() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED,
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      addFiles(
        result.assets.map((a) => ({
          key: `${a.name}-${a.size ?? 0}`,
          name: a.name,
          uri: a.uri,
          mimeType: a.mimeType ?? "application/octet-stream",
        }))
      );
    } catch {
      setError("Couldn't read that file — try again, or reveal a demo household below.");
    }
  }

  async function takePhoto() {
    setError(null);
    // No camera picker on web; the file dialog already offers the camera on a
    // phone browser, so fall back to it.
    if (Platform.OS === "web") return pickDocuments();

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera access needed",
        "Greenlight needs the camera to photograph your bill. You can also upload a PDF instead."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const name = asset.fileName ?? `bill-photo-${files.length + 1}.jpg`;
    addFiles([{ key: asset.assetId ?? name, name, uri: asset.uri, mimeType: asset.mimeType ?? "image/jpeg" }]);
  }

  function analyze() {
    const first = files[0];
    // Built as a query string rather than the { pathname, params } form: typed
    // routes reject a dynamically composed `pathname`, and a file URI needs
    // encoding regardless.
    const query = new URLSearchParams({
      name: first?.name ?? "",
      uri: first?.uri ?? "",
      mimeType: first?.mimeType ?? "",
      count: String(files.length),
    }).toString();
    router.push(`${route(variant, "/analyze")}?${query}` as Href);
  }

  return (
    <View className="w-full">
      <TactileButton
        accessibilityRole="button"
        accessibilityLabel="Put your utility bills to work"
        onPress={pickDocuments}
        className="w-full min-h-[178px] sm:min-h-[196px] items-center justify-center gap-2.5 rounded-[20px] border border-dashed border-line-strong bg-white/40 p-6 sm:p-8"
      >
        <View className="h-12 w-12 items-center justify-center rounded-2xl border border-brand/10 bg-white/60">
          <Upload size={21} strokeWidth={1.7} color="#1f5c3f" />
        </View>
        <Text className="mt-1 text-[16px] font-semibold text-brand text-center">
          Put your utility bills to work
        </Text>
        <Text className="max-w-sm text-center text-[12.5px] leading-relaxed text-ink-soft">
          PDF or photo · electricity and gas bills can be added together
        </Text>
      </TactileButton>

      {files.length > 0 && (
        <View className="mt-3 gap-1.5 px-1">
          {files.map((f) => (
            <CinematicReveal key={f.key}>
              <View className="flex-row items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-3 py-2">
                <FileText size={14} color="#8a897f" />
                <Text className="flex-1 text-[13px] text-ink" numberOfLines={1}>
                  {f.name}
                </Text>
                <TactileButton
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${f.name}`}
                  onPress={() => setFiles((c) => c.filter((x) => x.key !== f.key))}
                  className="p-1"
                >
                  <X size={14} color="#8a897f" />
                </TactileButton>
              </View>
            </CinematicReveal>
          ))}
        </View>
      )}

      {error && (
        <CinematicReveal>
          <Text className="mt-2 text-[12px] text-danger">{error}</Text>
        </CinematicReveal>
      )}

      <View className={`mt-3 gap-2 ${variant === "web" ? "sm:flex-row" : ""}`}>
        <TactileButton
          accessibilityRole="button"
          onPress={files.length > 0 ? analyze : () => router.push(route(variant, "/analyze"))}
          className="flex-1 items-center justify-center rounded-xl bg-brand py-3 min-h-[44px]"
        >
          <Text className="text-[14px] font-semibold text-white">
            {files.length > 0
              ? `Analyze ${files.length} bill${files.length === 1 ? "" : "s"}`
              : "Reveal a demo household"}
          </Text>
        </TactileButton>

        <TactileButton
          accessibilityRole="button"
          onPress={takePhoto}
          className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-white/90 bg-white/40 py-3 min-h-[44px]"
        >
          <Camera size={15} color="#1f5c3f" />
          <Text className="text-[14px] font-semibold text-brand">Take a photo</Text>
        </TactileButton>
      </View>

      {files.length > 0 && (
        <TactileButton
          accessibilityRole="button"
          onPress={() => router.push(route(variant, "/analyze"))}
          className="mt-2 w-full items-center py-2"
        >
          <Text className="text-[12px] text-ink-muted">Or try a demo household instead</Text>
        </TactileButton>
      )}
    </View>
  );
}
