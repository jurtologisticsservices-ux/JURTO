import { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { bookingStore, useBookingStore } from "@/src/lib/bookingStore";
import { fetchSuggestions, Suggestion } from "@/src/lib/api";

export default function StopsScreen() {
  const router = useRouter();
  const { stops } = useBookingStore();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const onChange = (index: number, text: string) => {
    bookingStore.updateStop(index, { address: text, place_id: null, lat: null, lng: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setActiveIndex(index);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const list = await fetchSuggestions(text.trim());
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const pick = (s: Suggestion) => {
    if (activeIndex == null) return;
    bookingStore.updateStop(activeIndex, { address: s.text, place_id: s.placeId, lat: null, lng: null });
    setSuggestions([]);
    setActiveIndex(null);
    Keyboard.dismiss();
  };

  const canContinue = stops[0].address.trim().length > 0 && stops.slice(1).every((s) => s.address.trim().length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-button" hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.onSurface} />
        </Pressable>
        <Text style={styles.title}>Route</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {stops.map((s, i) => (
          <View key={i} style={{ marginBottom: S.sm }}>
            <View style={styles.field}>
              <View style={[styles.dot, { backgroundColor: i === 0 ? C.brand : C.onSurface }]} />
              <TextInput
                testID={`stop-${i}-input`}
                value={s.address}
                onChangeText={(t) => onChange(i, t)}
                onFocus={() => setActiveIndex(i)}
                placeholder={i === 0 ? "Pickup location" : `Drop-off ${i}`}
                placeholderTextColor={C.onSurfaceTertiary}
                style={styles.input}
              />
              {stops.length > 2 && i > 0 && (
                <Pressable
                  onPress={() => bookingStore.removeStop(i)}
                  hitSlop={10}
                  testID={`stop-${i}-remove`}
                  style={styles.removeBtn}
                >
                  <Feather name="x" size={16} color={C.onSurfaceSecondary} />
                </Pressable>
              )}
            </View>
            {activeIndex === i && suggestions.length > 0 && (
              <View style={styles.dropdown} testID={`stop-${i}-suggestions`}>
                {suggestions.map((sg) => (
                  <Pressable key={sg.placeId} style={styles.dropItem} onPress={() => pick(sg)}>
                    <Feather name="map-pin" size={14} color={C.brand} />
                    <Text style={styles.dropText} numberOfLines={2}>{sg.text}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {activeIndex === i && loading && (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={C.brand} />
                <Text style={styles.inlineLoadingText}>Searching…</Text>
              </View>
            )}
          </View>
        ))}

        {stops.length < 5 && (
          <Pressable
            onPress={() => bookingStore.addStop()}
            style={styles.addStopBtn}
            testID="add-stop-button"
          >
            <Feather name="plus" size={16} color={C.brand} />
            <Text style={styles.addStopText}>ADD STOP</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="continue-button"
          disabled={!canContinue}
          onPress={() => router.push("/booking/vehicle")}
          style={[styles.cta, !canContinue && { opacity: 0.4 }]}
        >
          <Text style={styles.ctaText}>CHOOSE VEHICLE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  header: {
    paddingHorizontal: S.md, paddingVertical: S.md, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: S.sm, borderRadius: R.pill, backgroundColor: C.surfaceSecondary, width: 40, alignItems: "center" },
  title: { fontFamily: DISPLAY, fontSize: 18, color: C.onSurface },
  field: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surfaceSecondary, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: 4, gap: S.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: { flex: 1, fontFamily: TEXT, fontSize: 15, color: C.onSurface, paddingVertical: 14 },
  removeBtn: { padding: S.sm },
  dropdown: {
    marginTop: 4, backgroundColor: C.surfaceSecondary,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border, overflow: "hidden",
  },
  dropItem: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    padding: S.md, borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  dropText: { flex: 1, fontFamily: TEXT, fontSize: 13, color: C.onSurface },
  inlineLoading: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: 4 },
  inlineLoadingText: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceSecondary },
  addStopBtn: {
    marginTop: S.md, flexDirection: "row", alignItems: "center", gap: S.sm,
    alignSelf: "flex-start", paddingHorizontal: S.md, paddingVertical: S.sm,
    borderWidth: 1, borderColor: C.brand, borderRadius: R.pill, borderStyle: "dashed",
  },
  addStopText: { fontFamily: TEXT, fontSize: 12, color: C.brand, fontWeight: "700", letterSpacing: 1 },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: S.md, backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cta: { backgroundColor: C.brand, paddingVertical: 16, borderRadius: R.pill, alignItems: "center" },
  ctaText: { fontFamily: TEXT, fontSize: 13, fontWeight: "700", color: C.onBrand, letterSpacing: 2 },
});
