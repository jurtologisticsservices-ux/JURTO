import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { Order, listOrders } from "@/src/lib/api";

const STATUS_LABEL: Record<Order["status"], string> = {
  searching: "SEARCHING",
  assigned: "ASSIGNED",
  picked_up: "IN TRANSIT",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

const STATUS_BG: Record<Order["status"], string> = {
  searching: C.warning,
  assigned: C.info,
  picked_up: C.brand,
  delivered: C.success,
  cancelled: C.error,
};

const ACTIVE: Order["status"][] = ["searching", "assigned", "picked_up"];

function relTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function OrdersTab() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listOrders();
      setOrders(list);
    } catch {
      setOrders([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (orders === null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Header />
        <View style={styles.center}><ActivityIndicator size="large" color={C.brand} /></View>
      </SafeAreaView>
    );
  }

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));
  const sections = [
    { key: "active", label: "ACTIVE", items: active },
    { key: "past", label: "PAST", items: past },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Header />
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: S.lg, paddingTop: S.md }}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>{item.label}</Text>
              <Text style={styles.sectionCount}>{item.items.length}</Text>
            </View>
            {item.items.length === 0 ? (
              <View style={styles.empty} testID={`empty-${item.key}`}>
                <Feather name={item.key === "active" ? "package" : "archive"} size={22} color={C.onSurfaceTertiary} />
                <Text style={styles.emptyText}>{item.key === "active" ? "No active orders" : "No past orders yet"}</Text>
              </View>
            ) : (
              item.items.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => router.push(`/tracking/${o.id}`)}
                  testID={`order-card-${o.id}`}
                  style={styles.card}
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.cardId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                    <View style={[styles.badge, { backgroundColor: STATUS_BG[o.status] }]}>
                      <Text style={styles.badgeText}>{STATUS_LABEL[o.status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDate}>{relTime(o.created_at)}</Text>

                  <View style={styles.stopsCol}>
                    <View style={styles.stopRow}>
                      <View style={[styles.stopDot, { backgroundColor: C.brand }]} />
                      <Text style={styles.stopText} numberOfLines={1}>{o.stops[0]?.address}</Text>
                    </View>
                    <View style={styles.stopSpacer} />
                    <View style={styles.stopRow}>
                      <View style={[styles.stopDot, { backgroundColor: C.onSurface }]} />
                      <Text style={styles.stopText} numberOfLines={1}>{o.stops[o.stops.length - 1]?.address}</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardMeta}>{o.vehicle_name}  ·  {o.distance_km.toFixed(1)} km</Text>
                    <Text style={styles.cardFare}>₹{Math.round(o.fare).toLocaleString("en-IN")}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.title}>My orders</Text>
        <Text style={styles.subtitle}>Active and past deliveries</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  headerRow: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.md },
  title: { fontFamily: DISPLAY, fontSize: 24, color: C.onSurface, letterSpacing: -0.4 },
  subtitle: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: S.sm, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6,
  },
  sectionTitle: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 2, fontWeight: "700" },
  sectionCount: {
    fontFamily: TEXT, fontSize: 11, color: C.onSurface, fontWeight: "700",
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 1, borderRadius: R.pill,
  },
  empty: { alignItems: "center", padding: S.xl, gap: 6 },
  emptyText: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceTertiary },
  card: {
    backgroundColor: C.surfaceSecondary, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border, padding: S.md, marginBottom: S.sm,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardId: { fontFamily: TEXT, fontSize: 12, color: C.onSurface, fontWeight: "700", letterSpacing: 0.5 },
  cardDate: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, marginTop: 2 },
  badge: { paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.pill },
  badgeText: { fontFamily: TEXT, fontSize: 9, color: "#FFFFFF", fontWeight: "800", letterSpacing: 1 },
  stopsCol: { marginTop: S.md, gap: 0 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: S.sm },
  stopDot: { width: 8, height: 8, borderRadius: 4 },
  stopText: { flex: 1, fontFamily: TEXT, fontSize: 13, color: C.onSurface },
  stopSpacer: { height: 10, marginLeft: 3, borderLeftWidth: 2, borderLeftColor: C.borderStrong },
  cardFooter: {
    marginTop: S.md, paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  cardMeta: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary },
  cardFare: { fontFamily: DISPLAY, fontSize: 18, color: C.brand, fontWeight: "700" },
});
