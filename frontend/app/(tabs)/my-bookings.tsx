import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { C, MONO, DISPLAY } from "@/src/lib/theme";
import { Booking, BookingStatus, listBookings } from "@/src/lib/api";

const STATUS_LABEL: Record<BookingStatus, string> = {
  searching: "SEARCHING",
  assigned: "ASSIGNED",
  picked_up: "IN TRANSIT",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  searching: C.warning,
  assigned: C.brand,
  picked_up: C.brand,
  delivered: C.success,
  cancelled: C.error,
};

const ACTIVE_STATUSES: BookingStatus[] = ["searching", "assigned", "picked_up"];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).toUpperCase();
  } catch {
    return iso;
  }
}

export default function MyBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listBookings();
      setBookings(list);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load bookings");
      setBookings([]);
    }
  }, []);

  // Refresh whenever this tab gets focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const active = (bookings ?? []).filter((b) => ACTIVE_STATUSES.includes(b.status));
  const past = (bookings ?? []).filter((b) => !ACTIVE_STATUSES.includes(b.status));

  if (bookings === null && !error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Header />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.onSurface} />
          <Text style={styles.loadingText}>LOADING…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections: { key: string; label: string; items: Booking[] }[] = [
    { key: "active", label: "ACTIVE", items: active },
    { key: "past", label: "PAST", items: past },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Header />
      <FlatList
        data={sections}
        keyExtractor={(s) => s.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.onSurface} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={null}
        renderItem={({ item }) => (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>[ {item.label} ]</Text>
              <Text style={styles.sectionCount}>{item.items.length}</Text>
            </View>
            {item.items.length === 0 ? (
              <View style={styles.emptyBlock} testID={`empty-${item.key}`}>
                <Text style={styles.emptyText}>
                  {item.key === "active" ? "NO ACTIVE ORDERS" : "NO PAST ORDERS"}
                </Text>
              </View>
            ) : (
              item.items.map((b) => (
                <BookingCard key={b.id} booking={b} onPress={() => router.push(`/tracking/${b.id}`)} />
              ))
            )}
          </View>
        )}
        ListFooterComponent={
          error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>! {error.toUpperCase()}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>MY BOOKINGS</Text>
      <Text style={styles.headerSubtitle}>{"// ORDER HISTORY"}</Text>
    </View>
  );
}

function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const statusColor = STATUS_COLOR[booking.status];
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      testID={`booking-card-${booking.id}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardId}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.cardDate}>{formatDate(booking.created_at)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor }]}>
          <Text style={styles.badgeText}>{STATUS_LABEL[booking.status]}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.routeCol}>
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: C.brand }]} />
            <Text style={styles.routeAddress} numberOfLines={1}>{booking.pickup_address}</Text>
          </View>
          <View style={styles.routeSpacer} />
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: C.onSurface }]} />
            <Text style={styles.routeAddress} numberOfLines={1}>{booking.dropoff_address}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>VEHICLE</Text>
          <Text style={styles.footerValue}>{booking.vehicle_name}</Text>
        </View>
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>DISTANCE</Text>
          <Text style={styles.footerValue}>{booking.distance_km.toFixed(1)} KM</Text>
        </View>
        <View style={styles.footerCol}>
          <Text style={styles.footerLabel}>FARE</Text>
          <Text style={[styles.footerValue, { color: C.brand }]}>₹{booking.fare.toFixed(0)}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={C.onSurface} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.borderStrong,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    backgroundColor: C.surface,
  },
  headerTitle: { fontFamily: DISPLAY, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, color: C.onSurface },
  headerSubtitle: { fontFamily: MONO, fontSize: 11, color: C.onSurface, letterSpacing: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.onSurface },
  errorText: { fontFamily: MONO, fontSize: 11, color: C.error, letterSpacing: 1 },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 2,
    borderColor: C.error,
    backgroundColor: "#FFF0F0",
    padding: 10,
  },

  listContent: { paddingVertical: 8, paddingBottom: 24 },
  sectionBlock: { paddingHorizontal: 16, paddingTop: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderStrong,
  },
  sectionTitle: { fontFamily: MONO, fontSize: 12, letterSpacing: 1.5, color: C.onSurface, fontWeight: "900" },
  sectionCount: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.onSurface,
    borderWidth: 2,
    borderColor: C.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontWeight: "900",
  },
  emptyBlock: {
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.surfaceSecondary,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1,
    color: C.onSurface,
    opacity: 0.5,
  },

  card: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cardHeaderLeft: { flex: 1 },
  cardId: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: 0.8,
  },
  cardDate: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    opacity: 0.6,
    marginTop: 2,
  },
  badge: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "900",
    color: C.onSurfaceInverse,
    letterSpacing: 1,
  },

  cardBody: { paddingHorizontal: 12, paddingVertical: 10 },
  routeCol: { gap: 2 },
  routeItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeDot: { width: 8, height: 8 },
  routeAddress: { flex: 1, fontFamily: MONO, fontSize: 12, color: C.onSurface },
  routeSpacer: { height: 8, marginLeft: 3, borderLeftWidth: 2, borderLeftColor: C.borderStrong },

  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 12,
    backgroundColor: C.surfaceSecondary,
  },
  footerCol: { flex: 1 },
  footerLabel: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    color: C.onSurface,
    opacity: 0.6,
  },
  footerValue: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "900",
    color: C.onSurface,
    marginTop: 2,
  },
});
