import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { TopBar } from "./addresses";

const CONTACT: { icon: keyof typeof Feather.glyphMap; label: string; sub: string; onPress?: () => void }[] = [
  { icon: "phone", label: "Call support", sub: "24/7 · +91 90000 12345", onPress: () => Linking.openURL("tel:+919000012345") },
  { icon: "mail", label: "Email us", sub: "help@luxelogistics.in", onPress: () => Linking.openURL("mailto:help@luxelogistics.in") },
  { icon: "message-circle", label: "Chat with us", sub: "Coming soon" },
];

const FAQ = [
  { q: "How is my fare calculated?", a: "Total road distance × vehicle rate. We show only the final all-inclusive fare — no hidden charges." },
  { q: "What if the driver cancels?", a: "You'll be automatically re-matched to the next available driver at no extra cost." },
  { q: "Can I add multiple drop-offs?", a: "Yes — tap 'Add Stop' on the route screen to include up to five destinations." },
];

export default function HelpScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar title="Help & Support" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: S.lg }}>
        <Text style={styles.section}>REACH US</Text>
        <View style={styles.card}>
          {CONTACT.map((c, i) => (
            <Pressable key={c.label} onPress={c.onPress} style={[styles.row, i === CONTACT.length - 1 && { borderBottomWidth: 0 }]} testID={`help-${c.icon}`}>
              <View style={styles.rowIcon}><Feather name={c.icon} size={16} color={C.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Text style={styles.rowSub}>{c.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={C.onSurfaceTertiary} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>FREQUENTLY ASKED</Text>
        {FAQ.map((f, i) => (
          <View key={i} style={styles.faq}>
            <Text style={styles.q}>{f.q}</Text>
            <Text style={styles.a}>{f.a}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  section: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 2, marginBottom: S.sm, marginTop: S.md, fontWeight: "600" },
  card: { backgroundColor: C.surfaceSecondary, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    paddingHorizontal: S.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  rowLabel: { fontFamily: TEXT, fontSize: 14, color: C.onSurface, fontWeight: "600" },
  rowSub: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  faq: {
    backgroundColor: C.surfaceSecondary, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border, padding: S.md, marginBottom: S.sm,
  },
  q: { fontFamily: DISPLAY, fontSize: 15, color: C.onSurface },
  a: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 6, lineHeight: 18 },
});
