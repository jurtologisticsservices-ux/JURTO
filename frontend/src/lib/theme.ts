import { Platform } from "react-native";

export const C = {
  surface: "#FFFFFF",
  onSurface: "#111111",
  surfaceSecondary: "#F4F4F0",
  surfaceTertiary: "#EBEBE6",
  surfaceInverse: "#111111",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF4500",
  brandTertiary: "#FFDCD1",
  onBrandPrimary: "#FFFFFF",
  border: "#E0E0DB",
  borderStrong: "#111111",
  success: "#00B85E",
  warning: "#FFC300",
  error: "#E63946",
} as const;

export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
export const DISPLAY = Platform.select({ ios: "Helvetica", android: "sans-serif-condensed", default: "System" });
