import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, TEXT, S, R } from "@/src/lib/theme";
import { updateProfile } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { TopBar } from "./addresses";

export default function GstScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [gst, setGst] = useState(user?.gst_number ?? "");
  const [name, setName] = useState(user?.gst_business_name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setGst(user?.gst_number ?? ""); setName(user?.gst_business_name ?? ""); }, [user]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const u = await updateProfile({ gst_number: gst.trim(), gst_business_name: name.trim() });
      updateUser(u);
      setMsg("Saved");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar title="GST Details" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: S.lg }}>
        <Text style={styles.intro}>Add your business GST information to receive tax-compliant invoices for every trip.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            testID="gst-business-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Acme Traders Pvt Ltd"
            placeholderTextColor={C.onSurfaceTertiary}
            style={styles.input}
            autoCapitalize="words"
          />
          <View style={styles.divider} />
          <Text style={styles.label}>GSTIN</Text>
          <TextInput
            testID="gst-number-input"
            value={gst}
            onChangeText={setGst}
            placeholder="15-character GSTIN"
            placeholderTextColor={C.onSurfaceTertiary}
            style={styles.input}
            autoCapitalize="characters"
            maxLength={15}
          />
        </View>

        {msg && <Text style={[styles.msg, { color: msg === "Saved" ? C.success : C.error }]}>{msg}</Text>}

        <Pressable testID="save-gst-button" onPress={save} disabled={busy} style={[styles.cta, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color={C.onBrand} /> : (
            <>
              <Feather name="save" size={16} color={C.onBrand} />
              <Text style={styles.ctaText}>SAVE GST DETAILS</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  intro: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary, lineHeight: 20, marginBottom: S.lg },
  card: {
    backgroundColor: C.surfaceSecondary, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, padding: S.md,
  },
  label: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 1.2, marginBottom: 6 },
  input: {
    fontFamily: TEXT, fontSize: 15, color: C.onSurface,
    backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: 12,
  },
  divider: { height: S.md },
  cta: {
    marginTop: S.xl, backgroundColor: C.brand, paddingVertical: 16, borderRadius: R.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.sm,
  },
  ctaText: { fontFamily: TEXT, fontSize: 13, fontWeight: "700", color: C.onBrand, letterSpacing: 2 },
  msg: { fontFamily: TEXT, fontSize: 12, marginTop: S.md, textAlign: "center" },
});
