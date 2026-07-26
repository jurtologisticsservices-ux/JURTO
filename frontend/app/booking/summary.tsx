import { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { bookingStore, useBookingStore } from "@/src/lib/bookingStore";
import { createOrder } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";

type PM = "cash_pickup" | "cash_drop" | "upi";

const PAY_OPTIONS: { id: PM; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "cash_pickup", label: "COD at Pickup", icon: "arrow-up-circle" },
  { id: "cash_drop", label: "COD at Drop", icon: "arrow-down-circle" },
  { id: "upi", label: "UPI", icon: "smartphone" },
];

export default function SummaryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { stops, vehicle, distanceKm, paymentMethod, receiverName, receiverPhone, goodsNote } = useBookingStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fare = vehicle && distanceKm != null ? Math.round(vehicle.rate * distanceKm) : 0;

  const submit = async () => {
    if (!vehicle || distanceKm == null) return;
    const rDigits = receiverPhone.replace(/\D/g, "");
    if (!receiverName.trim()) return setError("Receiver name required");
    if (rDigits.length < 10) return setError("Enter valid 10-digit receiver phone");
    if (!goodsNote.trim()) return setError("Describe the goods");

    setBusy(true);
    setError(null);
    try {
      const order = await createOrder({
        vehicle_type: vehicle.id,
        stops: stops.map((s) => ({ address: s.address, lat: s.lat, lng: s.lng, place_id: s.place_id })),
        distance_km: distanceKm,
        payment_method: paymentMethod,
        sender_phone: user?.phone,
        receiver_name: receiverName.trim(),
        receiver_phone: rDigits,
        goods_note: goodsNote.trim(),
      });
      bookingStore.reset();
      router.replace(`/tracking/${order.id}`);
    } catch (e: any) {
      setError(e?.message || "Booking failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="back-button" hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.onSurface} />
        </Pressable>
        <Text style={styles.title}>Booking summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: S.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          {/* Route */}
          <View style={styles.card}>
            {stops.map((s, i) => (
              <View key={i} style={styles.routeRow}>
                <View style={styles.routeIcon}>
                  <View style={[styles.routeDot, { backgroundColor: i === 0 ? C.brand : C.onSurface }]} />
                  {i < stops.length - 1 && <View style={styles.routeLine} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>{s.label?.toUpperCase() ?? (i === 0 ? "PICKUP" : `DROP ${i}`)}</Text>
                  <Text style={styles.routeAddress} numberOfLines={2}>{s.address}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Vehicle summary */}
          {vehicle && (
            <View style={[styles.card, { marginTop: S.md, flexDirection: "row", alignItems: "center", gap: S.md }]}>
              <View style={styles.vehiclePill}>
                <Feather name="truck" size={18} color={C.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>{vehicle.name}</Text>
                <Text style={styles.vehicleMeta}>{vehicle.capacity_kg} kg · {vehicle.eta_min} min away</Text>
              </View>
              <Pressable onPress={() => router.back()}>
                <Text style={styles.changeBtn}>CHANGE</Text>
              </Pressable>
            </View>
          )}

          {/* Receiver + goods */}
          <Text style={styles.sectionLabel}>RECEIVER DETAILS</Text>
          <View style={styles.card}>
            <TextInput
              testID="receiver-name-input"
              value={receiverName}
              onChangeText={(t) => bookingStore.set({ receiverName: t })}
              placeholder="Receiver name"
              placeholderTextColor={C.onSurfaceTertiary}
              style={styles.input}
              autoCapitalize="words"
            />
            <View style={styles.divider} />
            <TextInput
              testID="receiver-phone-input"
              value={receiverPhone}
              onChangeText={(t) => bookingStore.set({ receiverPhone: t })}
              placeholder="Receiver phone"
              placeholderTextColor={C.onSurfaceTertiary}
              keyboardType="phone-pad"
              maxLength={12}
              style={styles.input}
            />
            <View style={styles.divider} />
            <TextInput
              testID="goods-note-input"
              value={goodsNote}
              onChangeText={(t) => bookingStore.set({ goodsNote: t })}
              placeholder="What are you sending? (e.g. 5 Furniture Boxes)"
              placeholderTextColor={C.onSurfaceTertiary}
              style={[styles.input, { minHeight: 44 }]}
              multiline
            />
          </View>

          {/* Payment */}
          <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
          <View style={styles.payGrid}>
            {PAY_OPTIONS.map((opt) => {
              const active = paymentMethod === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => bookingStore.set({ paymentMethod: opt.id })}
                  testID={`payment-${opt.id}`}
                  style={[styles.payOpt, active && styles.payOptActive]}
                >
                  <Feather name={opt.icon} size={18} color={active ? C.brand : C.onSurfaceSecondary} />
                  <Text style={[styles.payLabel, active && { color: C.onSurface }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error && <Text style={styles.error} testID="summary-error">{error}</Text>}
        </ScrollView>

        {/* Sticky footer with fare + confirm */}
        <View style={styles.footer}>
          <View style={styles.fareCol}>
            <Text style={styles.fareLabel}>TOTAL FARE</Text>
            <Text style={styles.fareValue} testID="fare-value">₹{fare.toLocaleString("en-IN")}</Text>
          </View>
          <Pressable
            testID="confirm-booking-button"
            disabled={busy}
            onPress={submit}
            style={[styles.cta, busy && { opacity: 0.6 }]}
          >
            {busy ? <ActivityIndicator color={C.onBrand} /> : <Text style={styles.ctaText}>CONFIRM BOOKING →</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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

  card: {
    backgroundColor: C.surfaceSecondary, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border,
    padding: S.md,
  },
  routeRow: { flexDirection: "row", gap: S.md, paddingVertical: 6 },
  routeIcon: { width: 14, alignItems: "center" },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: { width: 2, flex: 1, backgroundColor: C.borderStrong, marginTop: 2 },
  routeLabel: { fontFamily: TEXT, fontSize: 10, letterSpacing: 1.2, color: C.onSurfaceTertiary, fontWeight: "600" },
  routeAddress: { fontFamily: TEXT, fontSize: 14, color: C.onSurface, marginTop: 2, lineHeight: 18 },

  vehiclePill: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  vehicleName: { fontFamily: DISPLAY, fontSize: 16, color: C.onSurface },
  vehicleMeta: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  changeBtn: { fontFamily: TEXT, fontSize: 11, color: C.brand, fontWeight: "700", letterSpacing: 1 },

  sectionLabel: {
    fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary,
    letterSpacing: 2, marginTop: S.lg, marginBottom: S.sm, fontWeight: "600",
  },
  input: {
    fontFamily: TEXT, fontSize: 15, color: C.onSurface,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },

  payGrid: { flexDirection: "row", gap: S.sm },
  payOpt: {
    flex: 1, backgroundColor: C.surfaceSecondary, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border, padding: S.md, alignItems: "center", gap: 6,
  },
  payOptActive: { borderColor: C.brand, backgroundColor: C.brandTertiary },
  payLabel: {
    fontFamily: TEXT, fontSize: 11, color: C.onSurfaceSecondary,
    fontWeight: "600", letterSpacing: 0.5, textAlign: "center",
  },

  error: { fontFamily: TEXT, fontSize: 12, color: C.error, marginTop: S.md },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", gap: S.md,
    padding: S.md, backgroundColor: C.surface,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  fareCol: {},
  fareLabel: { fontFamily: TEXT, fontSize: 10, color: C.onSurfaceTertiary, letterSpacing: 1.5 },
  fareValue: { fontFamily: DISPLAY, fontSize: 22, color: C.brand, fontWeight: "700" },
  cta: { flex: 1, backgroundColor: C.brand, paddingVertical: 16, borderRadius: R.pill, alignItems: "center" },
  ctaText: { fontFamily: TEXT, fontSize: 13, fontWeight: "700", color: C.onBrand, letterSpacing: 1.5 },
});
