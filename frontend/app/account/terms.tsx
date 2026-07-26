import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S } from "@/src/lib/theme";
import { TopBar } from "./addresses";

const SECTIONS = [
  {
    title: "1. Service",
    body: "LuxeLogistics provides on-demand transport services connecting customers with independent driver-partners in Chennai. We facilitate the booking; the actual transport is provided by the driver-partner.",
  },
  {
    title: "2. Fares",
    body: "The final total fare shown before booking is all-inclusive: base charge, distance, and applicable taxes. No hidden charges. Toll and parking (where applicable) are borne by the customer.",
  },
  {
    title: "3. Cancellation",
    body: "You may cancel a booking free of cost before a driver is assigned. Once a driver is en-route, a small cancellation fee (₹30) may apply to compensate the driver-partner.",
  },
  {
    title: "4. Prohibited items",
    body: "You may not use LuxeLogistics to transport hazardous materials, illegal substances, live animals, or fragile items without proper packaging. Full list available on request.",
  },
  {
    title: "5. Privacy",
    body: "Your data is stored securely. Location data is used solely to match drivers and enable live tracking. We never sell your data to third parties.",
  },
  {
    title: "6. Governing law",
    body: "These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Chennai, Tamil Nadu.",
  },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar title="Terms & Privacy" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 32 }}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated · 26 July 2026</Text>
        {SECTIONS.map((s, i) => (
          <View key={i} style={{ marginTop: S.lg }}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.footNote}>
          For the full legal text or to request data deletion, email legal@luxelogistics.in.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  title: { fontFamily: DISPLAY, fontSize: 24, color: C.onSurface, letterSpacing: -0.3 },
  updated: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, marginTop: 4, letterSpacing: 0.5 },
  sectionTitle: { fontFamily: DISPLAY, fontSize: 15, color: C.brand, marginBottom: 4 },
  sectionBody: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary, lineHeight: 20 },
  footNote: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, marginTop: S.xl, lineHeight: 16 },
});
