import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

// Brief §40: avoid endless rounded-card grids — prefer sections, dividers and
// structured rows. Card is used for genuine groupings, not every element.
export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("bg-card border border-line rounded-2xl overflow-hidden", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("px-5 pt-5 pb-3", className)} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("px-5 pb-5", className)} {...props} />;
}

export function Separator({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("h-px bg-line w-full", className)} {...props} />;
}

export function Row({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("flex-row items-center justify-between py-3", className)} {...props} />;
}
