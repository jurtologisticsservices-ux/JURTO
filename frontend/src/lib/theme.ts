import { Platform } from "react-native";

// Luxury Dark theme: Charcoal + Gold/Champagne
export const C = {
  surface: "#121212",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1E1E1E",
  onSurfaceSecondary: "#E0E0E0",
  surfaceTertiary: "#292929",
  onSurfaceTertiary: "#BDBDBD",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#121212",
  brand: "#D4AF37",
  brandSecondary: "#F3E5AB",
  brandTertiary: "#403517",
  onBrand: "#121212",
  success: "#3CBE64",
  warning: "#F5A623",
  error: "#E64545",
  info: "#4DA6FF",
  border: "#2A2A2A",
  borderStrong: "#444444",
  divider: "#1E1E1E",
} as const;

// Prefer Serif Display + Neutral Sans (per design guidelines Fraunces/Satoshi).
// We fall back to platform defaults since Google Fonts loader is disallowed.
export const DISPLAY = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});
export const TEXT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});
export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export const R = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
