import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";
import { TopBar } from "./addresses";

export default function ReferScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const code = (user?.phone?.slice(-4) ?? "LUXE").toUpperCase();
  const referralCode = `LUXE${code}`;

  const copy = async () => {
    try { await Clipboard.setStringAsync(referralCode); } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar title="Refer & Earn" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: S.lg }}>
        <View style={styles.hero}>
          <Feather name="gift" size={44} color={C.brand} />
          <Text style={styles.heroTitle}>Earn ₹200 for every friend</Text>
          <Text style={styles.heroSub}>Your friend gets ₹200 off their first booking. You get ₹200 credit once their trip completes.</Text>
        </View>

        <Text style={styles.label}>YOUR REFERRAL CODE</Text>
        <Pressable style={styles.codeCard} onPress={copy} testID="copy-code">
          <Text style={styles.code}>{referralCode}</Text>
          <View style={styles.copyPill}>
            <Feather name="copy" size={14} color={C.onBrand} />
            <Text style={styles.copyText}>TAP TO COPY</Text>
          </View>
        </Pressable>

        <View style={styles.note}>
          <Feather name="info" size={14} color={C.onSurfaceTertiary} />
          <Text style={styles.noteText}>Sharing coming soon. This is a preview of Refer & Earn.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  hero: {
    alignItems: "center", padding: S.xl,
    backgroundColor: C.surfaceSecondary, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, gap: S.sm,
  },
  heroTitle: { fontFamily: DISPLAY, fontSize: 20, color: C.onSurface, textAlign: "center" },
  heroSub: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", lineHeight: 18 },
  label: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 1.5, marginTop: S.xl, marginBottom: S.sm },
  codeCard: {
    backgroundColor: C.brandTertiary, borderWidth: 1, borderColor: C.brand,
    borderRadius: R.lg, padding: S.lg, alignItems: "center", gap: S.md,
  },
  code: { fontFamily: DISPLAY, fontSize: 30, letterSpacing: 4, color: C.brand, fontWeight: "700" },
  copyPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill,
  },
  copyText: { fontFamily: TEXT, fontSize: 11, color: C.onBrand, fontWeight: "700", letterSpacing: 1 },
  note: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: S.lg, paddingHorizontal: S.md,
  },
  noteText: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, flex: 1 },
});
