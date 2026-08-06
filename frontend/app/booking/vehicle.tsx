import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { bookingStore, useBookingStore } from "@/src/lib/bookingStore";
import { fetchDistanceMulti, fetchVehicles, Vehicle } from "@/src/lib/api";

const ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  motorbike: "motorbike",
  rickshaw: "rickshaw",
  "auto-rickshaw": "rickshaw",
  van: "van-passenger",
  "van-utility": "van-utility",
  truck: "truck",
};

export default function VehicleScreen() {
  const router = useRouter();
  const { stops, vehicle, distanceKm, durationText } = useBookingStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load vehicles + compute distance
  useEffect(() => {
    (async () => {
      try {
        const stopKeys = stops
          .map((s) =>
            s.place_id ||
            (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.address),
          )
          .filter(Boolean) as string[];
        const [vs, dist] = await Promise.all([
          fetchVehicles(),
          fetchDistanceMulti(stopKeys),
        ]);
        setVehicles(vs);

        // Safe default selection: prefer existing bookingStore vehicle, else a sane fallback.
        const currentVehicle = bookingStore.get().vehicle as Vehicle | null;
        const fallbackIndex = vs && vs.length > 0 ? Math.min(3, vs.length - 1) : -1;
        const fallbackVehicle = fallbackIndex >= 0 ? vs[fallbackIndex] : null;
        const defaultVehicle = currentVehicle ?? fallbackVehicle ?? null;

        if (!defaultVehicle && vs.length === 0) {
          setError("No vehicles available");
        }

        bookingStore.set({
          vehicle: defaultVehicle,
          distanceKm: dist.distance_km,
          durationText: dist.duration_text ?? null,
        });
      } catch (e: any) {
        setError(e?.message || "Could not load vehicles");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (v: Vehicle) => bookingStore.set({ vehicle: v });

  const fareFor = (v: Vehicle) => distanceKm != null ? Math.round(v.rate * distanceKm) : 0;

  const canContinue = !!vehicle && distanceKm != null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-button" hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.onSurface} />
        </Pressable>
        <Text style={styles.title}>Select vehicle</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.brand} />
          <Text style={styles.loading}>Estimating your fare…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={24} color={C.error} />
          <Text style={[styles.loading, { color: C.error }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* Hero card for selected vehicle */}
          {vehicle && (
            <View style={styles.hero} testID="vehicle-hero">
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroName}>{vehicle.name}</Text>
                  <View style={styles.heroChips}>
                    <View style={styles.chip}>
                      <MaterialCommunityIcons name="weight" size={12} color={C.onSurface} />
                      <Text style={styles.chipText}>{vehicle.capacity_kg} KG</Text>
                    </View>
                    <View style={styles.chip}>
                      <Feather name="clock" size={12} color={C.onSurface} />
                      <Text style={styles.chipText}>{vehicle.eta_min} MIN AWAY</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.heroIcon}>
                  <MaterialCommunityIcons
                    name={ICON_MAP[vehicle.icon] ?? "truck"}
                    size={44}
                    color={C.brand}
                  />
                </View>
              </View>
              <View style={styles.heroFareRow}>
                <View>
                  <Text style={styles.heroFareLabel}>ESTIMATED FARE</Text>
                  <Text style={styles.heroFare} testID="vehicle-fare">₹{fareFor(vehicle).toLocaleString("en-IN")}</Text>
                </View>
                {durationText ? (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.heroFareLabel}>TRAVEL TIME</Text>
                    <Text style={styles.heroDur}>{durationText}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>OTHER VEHICLES</Text>
          {vehicles.filter((v) => v.id !== vehicle?.id).map((v) => (
            <Pressable
              key={v.id}
              onPress={() => select(v)}
              testID={`vehicle-${v.id}`}
              style={styles.row}
            >
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={ICON_MAP[v.icon] ?? "truck"} size={26} color={C.onSurface} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{v.name}</Text>
                <Text style={styles.rowMeta}>{v.capacity_kg} kg · {v.eta_min} min</Text>
              </View>
              <Text style={styles.rowFare}>₹{fareFor(v).toLocaleString("en-IN")}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Pressable
          testID="continue-button"
          disabled={!canContinue}
          onPress={() => router.push("/booking/summary")}
          style={[styles.cta, !canContinue && { opacity: 0.4 }]}
        >
          <Text style={styles.ctaText}>CONTINUE</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loading: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary },

  hero: {
    backgroundColor: C.brandTertiary,
    borderColor: C.brand,
    borderWidth: 1,
    borderRadius: R.lg,
    padding: S.lg,
    marginBottom: S.lg,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroName: { fontFamily: DISPLAY, fontSize: 24, color: C.onSurface, letterSpacing: -0.4 },
  heroChips: { flexDirection: "row", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: R.pill, backgroundColor: "rgba(255,255,255,0.08)",
  },
  chipText: { fontFamily: TEXT, fontSize: 10, color: C.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  heroIcon: { alignItems: "center", justifyContent: "center", padding: S.sm },
  heroFareRow: {
    marginTop: S.lg, flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "rgba(212,175,55,0.3)", paddingTop: S.md,
  },
  heroFareLabel: { fontFamily: TEXT, fontSize: 10, color: C.brandSecondary, letterSpacing: 1.5 },
  heroFare: { fontFamily: DISPLAY, fontSize: 32, color: C.brand, fontWeight: "700", marginTop: 2 },
  heroDur: { fontFamily: TEXT, fontSize: 14, color: C.onSurface, fontWeight: "600", marginTop: 2 },

  sectionLabel: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 2, marginBottom: S.md, fontWeight: "600" },
  row: {
    flexDirection: "row", alignItems: "center", gap: S.md,
    backgroundColor: C.surfaceSecondary, borderRadius: R.md,
    padding: S.md, marginBottom: S.sm, borderWidth: 1, borderColor: C.border,
  },
  rowIcon: {
    width: 48, height: 48, borderRadius: R.md,
    backgroundColor: C.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
  rowName: { fontFamily: TEXT, fontSize: 15, color: C.onSurface, fontWeight: "600" },
  rowMeta: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  rowFare: { fontFamily: TEXT, fontSize: 16, color: C.onSurface, fontWeight: "700" },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    padding: S.md, backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cta: { backgroundColor: C.brand, paddingVertical: 16, borderRadius: R.pill, alignItems: "center" },
  ctaText: { fontFamily: TEXT, fontSize: 13, fontWeight: "700", color: C.onBrand, letterSpacing: 2 },
});
