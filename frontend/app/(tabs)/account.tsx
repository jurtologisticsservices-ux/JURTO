import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

type Row = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  route?: string;
  destructive?: boolean;
};

const ROWS: Row[] = [
  { key: "addresses", icon: "map-pin", label: "Saved Addresses", route: "/account/addresses" },
  { key: "gst", icon: "file-text", label: "GST Details", route: "/account/gst" },
  { key: "refer", icon: "gift", label: "Refer & Earn", route: "/account/refer" },
  { key: "help", icon: "help-circle", label: "Help & Support", route: "/account/help" },
  { key: "terms", icon: "shield", label: "Terms & Privacy", route: "/account/terms" },
];

export default function AccountTab() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name?.[0] ?? user?.phone?.slice(-2) ?? "U").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || "Add your name"}</Text>
            <Text style={styles.phone}>{user?.phone}</Text>
          </View>
        </View>

        <View style={styles.list}>
          {ROWS.map((r, i) => (
            <Pressable
              key={r.key}
              testID={`account-row-${r.key}`}
              onPress={() => r.route && router.push(r.route as any)}
              style={[styles.row, i === ROWS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.rowIcon}>
                <Feather name={r.icon} size={18} color={C.brand} />
              </View>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Feather name="chevron-right" size={18} color={C.onSurfaceTertiary} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutBtn} onPress={signOut} testID="logout-button">
          <Feather name="log-out" size={16} color={C.error} />
          <Text style={styles.logoutText}>LOG OUT</Text>
        </Pressable>

        <Text style={styles.version}>LuxeLogistics · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  profile: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    paddingHorizontal: S.lg, paddingTop: S.xl, paddingBottom: S.lg,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.brand, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontFamily: DISPLAY, fontSize: 22, color: C.onBrand, fontWeight: "700" },
  name: { fontFamily: DISPLAY, fontSize: 20, color: C.onSurface },
  phone: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary, marginTop: 2 },
  list: {
    marginTop: S.lg, marginHorizontal: S.lg,
    backgroundColor: C.surfaceSecondary, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: S.md, paddingVertical: 14, gap: S.md,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, fontFamily: TEXT, fontSize: 15, color: C.onSurface },
  logoutBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: S.sm,
    marginHorizontal: S.lg, marginTop: S.xl, paddingVertical: S.md,
    borderWidth: 1, borderColor: C.error, borderRadius: R.pill,
  },
  logoutText: { fontFamily: TEXT, fontSize: 12, color: C.error, fontWeight: "700", letterSpacing: 2 },
  version: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, textAlign: "center", marginTop: S.lg, opacity: 0.5 },
});
