import { useEffect, useRef, useState, useCallback } from "react";
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

const STATUS_STEPS: { id: BookingStatus; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "searching", label: "SEARCHING DRIVER", sub: "Matching a nearby partner", icon: "search" },
  { id: "assigned", label: "DRIVER ASSIGNED", sub: "Heading to pickup", icon: "user-check" },
  { id: "picked_up", label: "GOODS PICKED UP", sub: "In transit to drop", icon: "package" },
  { id: "delivered", label: "DELIVERED", sub: "Order complete", icon: "check-circle" },
];

const PAYMENT_LABEL: Record<Booking["payment_method"], string> = {
  cash_pickup: "COD PICKUP",
  cash_drop: "COD DROP",
  upi: "UPI",
};

const stepIndex = (s: BookingStatus): number => {
  const i = STATUS_STEPS.findIndex((st) => st.id === s);
  return i < 0 ? 0 : i;
};

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // Auto-progress demo flow: searching -> assigned (3s) -> picked_up (+8s) -> delivered (+10s)
  useEffect(() => {
    if (!booking) return;
    if (booking.status === "delivered" || booking.status === "cancelled") return;

    const schedule: { at: number; next: BookingStatus }[] = [];
    const current = stepIndex(booking.status);

    if (current < 1) schedule.push({ at: 3000, next: "assigned" });
    if (current < 2) schedule.push({ at: current < 1 ? 11000 : 8000, next: "picked_up" });
    if (current < 3) schedule.push({ at: current < 1 ? 21000 : current < 2 ? 18000 : 10000, next: "delivered" });

    schedule.forEach((s) => {
      const t = setTimeout(async () => {
        try {
          const updated = await updateBookingStatus(booking.id, s.next);
          setBooking(updated);
        } catch {
          // ignore transient errors; user can pull to refresh implicitly
        }
      }, s.at);
      timeoutsRef.current.push(t);
    });

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
    // Only reschedule when booking.id changes — not on every status update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const callDriver = async () => {
    if (!booking) return;
    const url = `tel:${booking.driver_phone}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) Linking.openURL(url);
    } catch {
      // no-op
    }
  };

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.back()} title="TRACK ORDER" />
        <View style={styles.center}>
          <Text style={styles.errorText}>! {error.toUpperCase()}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <TopBar onBack={() => router.back()} title="TRACK ORDER" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.onSurface} />
          <Text style={styles.loadingText}>LOADING…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStep = stepIndex(booking.status);
  const isSearching = booking.status === "searching";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <TopBar onBack={() => router.back()} title="TRACK ORDER" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Booking summary */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>ORDER ID</Text>
            <Text style={styles.cardValue} testID="booking-id">
              {booking.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>VEHICLE</Text>
            <Text style={styles.cardValue}>{booking.vehicle_name}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>DISTANCE</Text>
            <Text style={styles.cardValue}>{booking.distance_km.toFixed(2)} KM</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>FARE</Text>
            <Text style={[styles.cardValue, { color: C.brand }]}>₹{booking.fare.toFixed(2)}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>PAYMENT</Text>
            <Text style={styles.cardValue}>{PAYMENT_LABEL[booking.payment_method]}</Text>
          </View>
        </View>

        {/* Driver card — visible after 'searching' */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ DRIVER ]</Text>
          {isSearching ? (
            <View style={styles.searchingBox} testID="searching-driver">
              <ActivityIndicator color={C.onSurface} />
              <View style={{ flex: 1 }}>
                <Text style={styles.searchingTitle}>SEARCHING NEARBY DRIVERS…</Text>
                <Text style={styles.searchingSub}>Usually takes under 30 seconds</Text>
              </View>
            </View>
          ) : (
            <View style={styles.driverCard} testID="driver-card">
              <View style={styles.driverAvatar}>
                <Feather name="user" size={26} color={C.onSurfaceInverse} />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName} testID="driver-name">
                  {booking.driver_name.toUpperCase()}
                </Text>
                <View style={styles.plateBox}>
                  <Text style={styles.plateText} testID="vehicle-number">
                    {booking.vehicle_number}
                  </Text>
                </View>
                <Text style={styles.driverPhone}>{booking.driver_phone}</Text>
              </View>
              <Pressable style={styles.callBtn} onPress={callDriver} testID="call-driver-button">
                <Feather name="phone" size={20} color={C.onBrandPrimary} />
                <Text style={styles.callBtnText}>CALL</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ STATUS ]</Text>
          <View style={styles.timeline} testID="status-timeline">
            {STATUS_STEPS.map((step, idx) => {
              const done = idx < currentStep;
              const active = idx === currentStep;
              const isLast = idx === STATUS_STEPS.length - 1;
              return (
                <View key={step.id} style={styles.timelineRow} testID={`timeline-${step.id}`}>
                  <View style={styles.timelineIconCol}>
                    <View
                      style={[
                        styles.timelineNode,
                        done && styles.timelineNodeDone,
                        active && styles.timelineNodeActive,
                      ]}
                    >
                      <Feather
                        name={done ? "check" : step.icon}
                        size={16}
                        color={done || active ? C.onBrandPrimary : C.onSurface}
                      />
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          done && styles.timelineLineDone,
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.timelineText}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        (done || active) && styles.timelineLabelActive,
                      ]}
                    >
                      {step.label}
                    </Text>
                    <Text style={styles.timelineSub}>{step.sub}</Text>
                  </View>
                </View>
              );
            })}
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

        {/* Receiver */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ RECEIVER ]</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>NAME</Text>
              <Text style={styles.cardValue}>{booking.receiver_name.toUpperCase()}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>PHONE</Text>
              <Text style={styles.cardValue}>{booking.receiver_phone}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>GOODS</Text>
              <Text style={[styles.cardValue, { flex: 1, textAlign: "right" }]} numberOfLines={2}>
                {booking.goods_note.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} testID="back-button" hitSlop={12} style={styles.backBtn}>
        <Feather name="arrow-left" size={20} color={C.onSurface} />
      </Pressable>
      <Text style={styles.topBarTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  topBar: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.surface,
  },
  backBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    padding: 6,
  },
  topBarTitle: {
    fontFamily: DISPLAY,
    fontSize: 16,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: 0.5,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: C.onSurface },
  errorText: { fontFamily: MONO, fontSize: 12, color: C.error, letterSpacing: 1 },

  content: { paddingBottom: 32 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.onSurface,
    marginBottom: 10,
  },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSecondary,
    padding: 12,
    gap: 6,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  cardLabel: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.onSurface, opacity: 0.7 },
  cardValue: { fontFamily: MONO, fontSize: 13, fontWeight: "700", color: C.onSurface },

  searchingBox: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchingTitle: {
    fontFamily: DISPLAY,
    fontSize: 14,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: -0.2,
  },
  searchingSub: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 0.8,
    marginTop: 2,
    opacity: 0.6,
  },

  driverCard: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    backgroundColor: C.surfaceInverse,
    borderWidth: 2,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInfo: { flex: 1, gap: 4 },
  driverName: {
    fontFamily: DISPLAY,
    fontSize: 15,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: -0.2,
  },
  plateBox: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: C.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.warning,
  },
  plateText: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: 1,
  },
  driverPhone: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.onSurface,
    opacity: 0.7,
  },
  callBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 2,
  },
  callBtnText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 1,
  },

  timeline: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    padding: 14,
  },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineIconCol: { alignItems: "center", width: 36 },
  timelineNode: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineNodeDone: {
    backgroundColor: C.success,
  },
  timelineNodeActive: {
    backgroundColor: C.brand,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: C.border,
    marginVertical: 4,
  },
  timelineLineDone: { backgroundColor: C.success },
  timelineText: { flex: 1, paddingTop: 6, paddingBottom: 16 },
  timelineLabel: {
    fontFamily: DISPLAY,
    fontSize: 13,
    fontWeight: "900",
    color: C.onSurface,
    opacity: 0.4,
    letterSpacing: -0.2,
  },
  timelineLabelActive: { opacity: 1 },
  timelineSub: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 0.5,
    marginTop: 2,
    opacity: 0.55,
  },

  routeItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  routeDot: { width: 10, height: 10, marginTop: 4 },
  routeLabel: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1,
    color: C.onSurface,
    opacity: 0.6,
  },
  routeAddress: {
    fontFamily: MONO,
    fontSize: 12,
    color: C.onSurface,
    lineHeight: 16,
    marginTop: 2,
  },
  routeConnector: { height: 12, marginLeft: 4, borderLeftWidth: 2, borderLeftColor: C.borderStrong },
});
