import { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { C, MONO, DISPLAY } from "@/src/lib/theme";
import { Booking, BookingStatus, getBooking, updateBookingStatus } from "@/src/lib/api";
import LiveMap from "@/src/components/LiveMap";
import { useTrackingSocket } from "@/src/lib/useTrackingSocket";

const NEXT_ACTION: Partial<Record<BookingStatus, { next: BookingStatus; label: string }>> = {
  searching: { next: "assigned", label: "ACCEPT & DEPART" },
  assigned: { next: "picked_up", label: "GOODS PICKED UP" },
  picked_up: { next: "delivered", label: "DELIVERED" },
};

export default function DriverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const b = await getBooking(id);
      setBooking(b);
    } catch (e: any) {
      setError(e?.message || "Could not load booking");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const { snap, connected } = useTrackingSocket(id);

  useEffect(() => {
    if (!booking) return;
    const updates: Partial<Booking> = {};
    if (snap.status && snap.status !== booking.status) updates.status = snap.status;
    if (snap.driver_lat != null) updates.driver_lat = snap.driver_lat;
    if (snap.driver_lng != null) updates.driver_lng = snap.driver_lng;
    if (Object.keys(updates).length > 0) setBooking((prev) => (prev ? { ...prev, ...updates } : prev));
  }, [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = async () => {
    if (!booking) return;
    const action = NEXT_ACTION[booking.status];
    if (!action) return;
    setBusy(true);
    try {
      const b = await updateBookingStatus(booking.id, action.next);
      setBooking(b);
    } catch (e: any) {
      setError(e?.message || "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  const callSender = async () => {
    if (!booking) return;
    const url = `tel:${booking.sender_phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) Linking.openURL(url);
    } catch {
      // no-op
    }
  };

  const mapData = useMemo(
    () =>
      booking
        ? {
            pickup_lat: booking.pickup_lat,
            pickup_lng: booking.pickup_lng,
            dropoff_lat: booking.dropoff_lat,
            dropoff_lng: booking.dropoff_lng,
            driver_lat: booking.driver_lat,
            driver_lng: booking.driver_lng,
          }
        : null,
    [booking?.pickup_lat, booking?.pickup_lng, booking?.dropoff_lat, booking?.dropoff_lng, booking?.driver_lat, booking?.driver_lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorText}>! {error.toUpperCase()}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!booking) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.onSurface} />
          <Text style={styles.loadingText}>LOADING…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const action = NEXT_ACTION[booking.status];
  const isTerminal = !action;
  const currentTarget: "PICKUP" | "DROPOFF" | "COMPLETE" =
    booking.status === "searching" || booking.status === "assigned"
      ? "PICKUP"
      : booking.status === "picked_up"
      ? "DROPOFF"
      : "COMPLETE";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Map */}
        {mapData && (mapData.pickup_lat != null || mapData.driver_lat != null) ? (
          <View style={{ marginHorizontal: 16, marginTop: 16 }}>
            <View style={styles.liveBadgeRow}>
              <View style={[styles.liveDot, { backgroundColor: connected ? C.success : C.warning }]} />
              <Text style={styles.liveText}>{connected ? "LIVE" : "CONNECTING…"}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.targetText}>NAVIGATING TO {currentTarget}</Text>
            </View>
            <LiveMap data={mapData} height={280} testID="driver-live-map" />
          </View>
        ) : null}

        {/* Job overview */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>JOB ID</Text>
            <Text style={styles.cardValue}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>VEHICLE</Text>
            <Text style={styles.cardValue}>{booking.vehicle_name}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>FARE</Text>
            <Text style={[styles.cardValue, { color: C.brand }]}>₹{booking.fare.toFixed(2)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>PAYMENT</Text>
            <Text style={styles.cardValue}>
              {booking.payment_method === "cash_pickup"
                ? "COD PICKUP"
                : booking.payment_method === "cash_drop"
                ? "COD DROP"
                : "UPI"}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ ROUTE ]</Text>
          <View style={styles.card}>
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: C.brand }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeAddress}>{booking.pickup_address}</Text>
              </View>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: C.onSurface }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>DROP-OFF</Text>
                <Text style={styles.routeAddress}>{booking.dropoff_address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ CONTACTS ]</Text>
          <View style={styles.card}>
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>SENDER</Text>
                <Text style={styles.cardValue}>{booking.sender_phone}</Text>
              </View>
              <Pressable style={styles.callBtn} onPress={callSender} testID="call-sender-button">
                <Feather name="phone" size={16} color={C.onBrandPrimary} />
              </Pressable>
            </View>
            <View style={styles.rowSep} />
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>RECEIVER</Text>
                <Text style={styles.cardValue}>
                  {booking.receiver_name.toUpperCase()} · {booking.receiver_phone}
                </Text>
              </View>
              <Pressable
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${booking.receiver_phone}`)}
                testID="call-receiver-button"
              >
                <Feather name="phone" size={16} color={C.onBrandPrimary} />
              </Pressable>
            </View>
            <View style={styles.rowSep} />
            <View>
              <Text style={styles.cardLabel}>GOODS</Text>
              <Text style={styles.cardValue}>{booking.goods_note.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Status pill */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ CURRENT STATUS ]</Text>
          <View style={styles.statusPill} testID="driver-status">
            <Text style={styles.statusPillText}>{booking.status.toUpperCase().replace("_", " ")}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky action */}
      <View style={styles.actionBar}>
        {isTerminal ? (
          <View style={[styles.actionBtn, styles.actionBtnDone]}>
            <Feather name="check-circle" size={18} color={C.onSurface} />
            <Text style={styles.actionDoneText}>JOB COMPLETE</Text>
          </View>
        ) : (
          <Pressable
            testID="advance-status-button"
            onPress={advance}
            disabled={busy}
            style={[styles.actionBtn, busy && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color={C.onBrandPrimary} />
            ) : (
              <Text style={styles.actionText}>{action.label} →</Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} testID="back-button" hitSlop={12} style={styles.backBtn}>
        <Feather name="arrow-left" size={20} color={C.onSurface} />
      </Pressable>
      <View>
        <Text style={styles.topBarTitle}>DRIVER MODE</Text>
        <Text style={styles.topBarSubtitle}>{"// SIMULATOR"}</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  topBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.warning,
  },
  backBtn: { borderWidth: 2, borderColor: C.borderStrong, padding: 6, backgroundColor: C.surface },
  topBarTitle: {
    fontFamily: DISPLAY,
    fontSize: 16,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  topBarSubtitle: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 1.2,
    opacity: 0.7,
    textAlign: "center",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.onSurface },
  errorText: { fontFamily: MONO, fontSize: 12, color: C.error, letterSpacing: 1 },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: C.onSurface, marginBottom: 10 },

  liveBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  liveDot: { width: 8, height: 8 },
  liveText: { fontFamily: MONO, fontSize: 10, fontWeight: "900", color: C.onSurface, letterSpacing: 1 },
  targetText: { fontFamily: MONO, fontSize: 10, fontWeight: "900", color: C.onSurface, letterSpacing: 1 },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSecondary,
    padding: 12,
    gap: 6,
  },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  cardLabel: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.onSurface, opacity: 0.7 },
  cardValue: { fontFamily: MONO, fontSize: 13, fontWeight: "700", color: C.onSurface },

  routeItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  routeDot: { width: 10, height: 10, marginTop: 4 },
  routeLabel: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.onSurface, opacity: 0.6 },
  routeAddress: { fontFamily: MONO, fontSize: 12, color: C.onSurface, lineHeight: 16, marginTop: 2 },
  routeConnector: { height: 12, marginLeft: 4, borderLeftWidth: 2, borderLeftColor: C.borderStrong },

  contactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowSep: { height: 1, backgroundColor: C.border, marginVertical: 6 },
  callBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    padding: 8,
  },

  statusPill: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusPillText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 0.5,
  },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderTopColor: C.borderStrong,
    padding: 12,
    backgroundColor: C.surface,
  },
  actionBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionBtnDone: { backgroundColor: C.success },
  actionText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 1,
  },
  actionDoneText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: 1,
  },
});
