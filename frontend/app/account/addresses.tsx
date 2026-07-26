import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { listAddresses, saveAddress, deleteAddress, fetchSuggestions, SavedAddress, Suggestion } from "@/src/lib/api";

export default function AddressesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedAddress[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("Home");
  const [addr, setAddr] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [hits, setHits] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try { setItems(await listAddresses()); } catch { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onSearch = (t: string) => {
    setAddr(t); setPlaceId(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (t.trim().length < 3) { setHits([]); return; }
    debounceRef.current = setTimeout(async () => {
      try { setHits(await fetchSuggestions(t.trim())); } catch { setHits([]); }
    }, 300);
  };
  const pick = (s: Suggestion) => { setAddr(s.text); setPlaceId(s.placeId); setHits([]); Keyboard.dismiss(); };
  const save = async () => {
    if (!addr.trim()) return;
    setBusy(true);
    try {
      await saveAddress({ label: label.trim() || "Address", address: addr.trim(), place_id: placeId, lat: null, lng: null });
      setShowAdd(false); setLabel("Home"); setAddr(""); setPlaceId(null);
      await load();
    } finally { setBusy(false); }
  };
  const remove = async (id: string) => { await deleteAddress(id); await load(); };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar title="Saved Addresses" onBack={() => router.back()} rightIcon="plus" onRight={() => setShowAdd(true)} />
      <ScrollView contentContainerStyle={{ padding: S.lg }} keyboardShouldPersistTaps="handled">
        {items === null ? (
          <ActivityIndicator color={C.brand} style={{ marginTop: S.xl }} />
        ) : items.length === 0 && !showAdd ? (
          <View style={styles.empty} testID="addresses-empty">
            <Feather name="map-pin" size={22} color={C.onSurfaceTertiary} />
            <Text style={styles.emptyText}>No saved addresses yet. Tap + to add one.</Text>
          </View>
        ) : (
          items?.map((a) => (
            <View key={a.id} style={styles.row} testID={`address-${a.id}`}>
              <View style={styles.rowIcon}>
                <Feather name={a.label.toLowerCase() === "home" ? "home" : "briefcase"} size={16} color={C.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{a.label}</Text>
                <Text style={styles.rowAddr} numberOfLines={2}>{a.address}</Text>
              </View>
              <Pressable onPress={() => remove(a.id)} testID={`delete-${a.id}`} hitSlop={10}>
                <Feather name="trash-2" size={16} color={C.onSurfaceTertiary} />
              </Pressable>
            </View>
          ))
        )}

        {showAdd && (
          <View style={[styles.row, { flexDirection: "column", alignItems: "stretch", gap: S.sm, marginTop: S.md }]} testID="add-address-form">
            <TextInput
              testID="label-input"
              value={label}
              onChangeText={setLabel}
              placeholder="Label (Home, Office…)"
              placeholderTextColor={C.onSurfaceTertiary}
              style={styles.input}
            />
            <TextInput
              testID="address-input"
              value={addr}
              onChangeText={onSearch}
              placeholder="Search address"
              placeholderTextColor={C.onSurfaceTertiary}
              style={styles.input}
            />
            {hits.length > 0 && (
              <View style={styles.dropdown}>
                {hits.map((s) => (
                  <Pressable key={s.placeId} style={styles.dropItem} onPress={() => pick(s)}>
                    <Feather name="map-pin" size={14} color={C.brand} />
                    <Text style={styles.dropText} numberOfLines={2}>{s.text}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: S.sm }}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setShowAdd(false)}>
                <Text style={styles.btnGhostText}>CANCEL</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGold, busy && { opacity: 0.6 }]} onPress={save} testID="save-address-button" disabled={busy}>
                {busy ? <ActivityIndicator color={C.onBrand} /> : <Text style={styles.btnGoldText}>SAVE</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function TopBar({ title, onBack, rightIcon, onRight }: { title: string; onBack: () => void; rightIcon?: keyof typeof Feather.glyphMap; onRight?: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} testID="back-button" hitSlop={12} style={styles.backBtn}>
        <Feather name="arrow-left" size={20} color={C.onSurface} />
      </Pressable>
      <Text style={styles.topBarTitle}>{title}</Text>
      {rightIcon ? (
        <Pressable onPress={onRight} hitSlop={12} style={styles.backBtn} testID="topbar-right">
          <Feather name={rightIcon} size={20} color={C.brand} />
        </Pressable>
      ) : <View style={{ width: 40 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  topBar: {
    paddingHorizontal: S.md, paddingVertical: S.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: S.sm, borderRadius: R.pill, backgroundColor: C.surfaceSecondary, width: 40, alignItems: "center" },
  topBarTitle: { fontFamily: DISPLAY, fontSize: 18, color: C.onSurface },
  empty: { alignItems: "center", padding: S.xl, gap: 8 },
  emptyText: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceTertiary, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.surfaceSecondary, borderRadius: R.md,
    padding: S.md, marginBottom: S.sm, borderWidth: 1, borderColor: C.border,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  rowLabel: { fontFamily: TEXT, fontSize: 14, color: C.onSurface, fontWeight: "600" },
  rowAddr: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  input: {
    fontFamily: TEXT, fontSize: 15, color: C.onSurface,
    backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: 12,
  },
  dropdown: { backgroundColor: C.surface, borderRadius: R.sm, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  dropItem: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    paddingHorizontal: S.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  dropText: { flex: 1, fontFamily: TEXT, fontSize: 12, color: C.onSurface },
  btn: { flex: 1, paddingVertical: 12, borderRadius: R.pill, alignItems: "center" },
  btnGhost: { borderWidth: 1, borderColor: C.borderStrong },
  btnGhostText: { fontFamily: TEXT, fontSize: 12, color: C.onSurface, fontWeight: "700", letterSpacing: 1.5 },
  btnGold: { backgroundColor: C.brand },
  btnGoldText: { fontFamily: TEXT, fontSize: 12, color: C.onBrand, fontWeight: "700", letterSpacing: 1.5 },
});
