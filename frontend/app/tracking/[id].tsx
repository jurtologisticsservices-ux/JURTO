import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { Order, BookingStatus, getOrder, updateOrderStatus } from "@/src/lib/api";
import LiveMap from "@/src/components/LiveMap";
import { useTrackingSocket } from "@/src/lib/useTrackingSocket";

const STEPS: { id: BookingStatus; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "searching", label: "Searching driver", sub: "Matching a nearby partner", icon: "search" },
  { id: "assigned",  label: "Driver assigned", sub: "Heading to pickup", icon: "user-check" },
  { id: "picked_up", label: "Goods picked up", sub: "In transit to drop", icon: "package" },
  { id: "delivered", label: "Delivered", sub: "Order complete", icon: "check-circle" },
];

const stepIndex = (s: BookingStatus) => { const i = STEPS.findIndex((st) => st.id === s); return i < 0 ? 0 : i; };
const PAY: Record<Order["payment_method"], string> = { cash_pickup: "COD at Pickup", cash_drop: "COD at Drop", upi: "UPI" };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R2 = 6371, toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R2 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const o = await getOrder(id); setOrder(o);
    } catch (e: any) {
      setError(e?.message || "Could not load order");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const { snap, connected } = useTrackingSocket(id);
  useEffect(() => {
    if (!order) return;
    const updates: Partial<Order> = {};
    if (snap.status && snap.status !== order.status) updates.status = snap.status;
    if (snap.driver_lat != null) updates.driver_lat = snap.driver_lat;
    if (snap.driver_lng != null) updates.driver_lng = snap.driver_lng;
    if (Object.keys(updates).length > 0) setOrder((p) => (p ? { ...p, ...updates } : p));
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance status based on proximity
  useEffect(() => {
    if (!order) return;
    const { driver_lat, driver_lng, status, stops } = order;
    if (driver_lat == null || driver_lng == null || !stops.length) return;
    (async () => {
      try {
        if (status === "searching") {
          const p = stops[0];
          if (p.lat != null && p.lng != null && haversineKm(driver_lat, driver_lng, p.lat, p.lng) < 0.15) {
            const u = await updateOrderStatus(order.id, "assigned"); setOrder(u);
          }
        }
        if (status === "picked_up") {
          const d = stops[stops.length - 1];
          if (d.lat != null && d.lng != null && haversineKm(driver_lat, driver_lng, d.lat, d.lng) < 0.15) {
            const u = await updateOrderStatus(order.id, "delivered"); setOrder(u);
          }
        }
      } catch { /* ignore */ }
    })();
  }, [order?.driver_lat, order?.driver_lng, order?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const callDriver = async () => {
    if (!order) return;
    const url = `tel:${order.driver_phone}`;
    try { const s = await Linking.canOpenURL(url); if (s) Linking.openURL(url); } catch { /* ignore */ }
  };

  const mapData = useMemo(() => {
    if (!order) return null;
    const p = order.stops[0], d = order.stops[order.stops.length - 1];
    return {
      pickup_lat: p?.lat, pickup_lng: p?.lng,
      dropoff_lat: d?.lat, dropoff_lng: d?.lng,
      driver_lat: order.driver_lat, driver_lng: order.driver_lng,
    };
  }, [order?.stops, order?.driver_lat, order?.driver_lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.replace("/(tabs)")} />
        <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
      </SafeAreaView>
    );
  }
  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.replace("/(tabs)")} />
        <View style={styles.center}><ActivityIndicator size="large" color={C.brand} /></View>
      </SafeAreaView>
    );
  }

  const idx = stepIndex(order.status);
  const isSearching = order.status === "searching";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar onBack={() => router.replace("/(tabs)")} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {mapData && (mapData.pickup_lat != null || mapData.driver_lat != null) ? (
          <View style={{ marginHorizontal: S.lg, marginTop: S.md, borderRadius: R.lg, overflow: "hidden", borderWidth: 1, borderColor: C.border }}>
            <View style={styles.liveBadge}>
              <View style={[styles.dot, { backgroundColor: connected ? C.success : C.warning }]} />
              <Text style={styles.liveText}>{connected ? "LIVE TRACKING" : "CONNECTING…"}</Text>
            </View>
            <LiveMap data={mapData} height={220} testID="live-map" />
          </View>
        ) : null}

        {/* Driver card */}
        <View style={{ paddingHorizontal: S.lg, marginTop: S.lg }}>
          {isSearching ? (
            <View style={styles.card} testID="searching-driver">
              <ActivityIndicator color={C.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.searchingTitle}>Finding a driver…</Text>
                <Text style={styles.searchingSub}>Usually takes under 30 seconds</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.card, { flexDirection: "row", alignItems: "center", gap: S.md }]} testID="driver-card">
              <View style={styles.driverAvatar}>
                <Feather name="user" size={22} color={C.onBrand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName} testID="driver-name">{order.driver_name}</Text>
                <View style={styles.plate}><Text style={styles.plateText} testID="vehicle-number">{order.vehicle_number}</Text></View>
                <Text style={styles.driverPhone}>{order.driver_phone}</Text>
              </View>
              <Pressable style={styles.callBtn} onPress={callDriver} testID="call-driver-button">
                <Feather name="phone" size={18} color={C.onBrand} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={{ paddingHorizontal: S.lg, marginTop: S.lg }}>
          <Text style={styles.sectionLabel}>STATUS</Text>
          <View style={styles.card} testID="status-timeline">
            {STEPS.map((step, i) => {
              const done = i < idx, active = i === idx, isLast = i === STEPS.length - 1;
              return (
                <View key={step.id} style={styles.tlRow} testID={`timeline-${step.id}`}>
                  <View style={styles.tlIconCol}>
                    <View style={[styles.tlNode, done && styles.tlNodeDone, active && styles.tlNodeActive]}>
                      <Feather name={done ? "check" : step.icon} size={14} color={done || active ? C.onBrand : C.onSurfaceTertiary} />
                    </View>
                    {!isLast && <View style={[styles.tlLine, done && { backgroundColor: C.brand }]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: isLast ? 0 : S.md }}>
                    <Text style={[styles.tlLabel, (done || active) && { color: C.onSurface, opacity: 1 }]}>{step.label}</Text>
                    <Text style={styles.tlSub}>{step.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Route + summary */}
        <View style={{ paddingHorizontal: S.lg, marginTop: S.lg }}>
          <Text style={styles.sectionLabel}>ROUTE</Text>
          <View style={styles.card}>
            {order.stops.map((s, i) => (
              <View key={i} style={styles.routeRow}>
                <View style={styles.routeIcon}>
                  <View style={[styles.routeDot, { backgroundColor: i === 0 ? C.brand : C.onSurface }]} />
                  {i < order.stops.length - 1 && <View style={styles.routeLine} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabelText}>{i === 0 ? "PICKUP" : `DROP ${i}`}</Text>
                  <Text style={styles.routeAddress} numberOfLines={2}>{s.address}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: S.lg, marginTop: S.lg }}>
          <Text style={styles.sectionLabel}>ORDER</Text>
          <View style={styles.card}>
            <SumRow label="ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
            <SumRow label="Vehicle" value={order.vehicle_name} />
            <SumRow label="Distance" value={`${order.distance_km.toFixed(1)} km`} />
            <SumRow label="Payment" value={PAY[order.payment_method]} />
            <View style={[styles.sumRow, { marginTop: 6 }]}>
              <Text style={[styles.sumLabel, { color: C.onSurface }]}>Total</Text>
              <Text style={styles.sumFare}>₹{Math.round(order.fare).toLocaleString("en-IN")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue}>{value}</Text>
    </View>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} testID="back-button" hitSlop={12} style={styles.backBtn}>
        <Feather name="arrow-left" size={20} color={C.onSurface} />
      </Pressable>
      <Text style={styles.topBarTitle}>Track order</Text>
      <View style={{ width: 40 }} />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: TEXT, fontSize: 13, color: C.error },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: C.surfaceSecondary,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: TEXT, fontSize: 10, color: C.onSurface, letterSpacing: 1.5, fontWeight: "700" },
  card: {
    backgroundColor: C.surfaceSecondary, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, padding: S.md,
    flexDirection: "column",
  },
  sectionLabel: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 2, marginBottom: S.sm, fontWeight: "600" },
  searchingTitle: { fontFamily: DISPLAY, fontSize: 16, color: C.onSurface },
  searchingSub: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  driverName: { fontFamily: DISPLAY, fontSize: 16, color: C.onSurface },
  driverPhone: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  plate: {
    alignSelf: "flex-start", marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.sm,
    backgroundColor: C.brand,
  },
  plateText: { fontFamily: TEXT, fontSize: 11, color: C.onBrand, fontWeight: "800", letterSpacing: 1 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.brand, alignItems: "center", justifyContent: "center",
  },
  tlRow: { flexDirection: "row", gap: S.md },
  tlIconCol: { alignItems: "center", width: 26 },
  tlNode: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  tlNodeDone: { backgroundColor: C.brand },
  tlNodeActive: { backgroundColor: C.brand },
  tlLine: { width: 2, flex: 1, minHeight: 22, backgroundColor: C.border, marginVertical: 2 },
  tlLabel: { fontFamily: DISPLAY, fontSize: 14, color: C.onSurface, opacity: 0.5 },
  tlSub: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, marginTop: 2 },
  routeRow: { flexDirection: "row", gap: S.md, paddingVertical: 4 },
  routeIcon: { width: 14, alignItems: "center" },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: { width: 2, flex: 1, backgroundColor: C.border, marginTop: 2 },
  routeLabelText: { fontFamily: TEXT, fontSize: 10, letterSpacing: 1.2, color: C.onSurfaceTertiary, fontWeight: "600" },
  routeAddress: { fontFamily: TEXT, fontSize: 13, color: C.onSurface, marginTop: 2, lineHeight: 18 },
  sumRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 6,
  },
  sumLabel: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceTertiary },
  sumValue: { fontFamily: TEXT, fontSize: 13, color: C.onSurface, fontWeight: "600" },
  sumFare: { fontFamily: DISPLAY, fontSize: 22, color: C.brand, fontWeight: "700" },
});
