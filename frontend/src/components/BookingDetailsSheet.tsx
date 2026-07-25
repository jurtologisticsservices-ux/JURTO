import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { C, MONO, DISPLAY } from "@/src/lib/theme";
import { createBooking, Vehicle, CreateBookingInput } from "@/src/lib/api";

type PaymentMethod = "cash_pickup" | "cash_drop" | "upi";

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "cash_pickup", label: "COD PICKUP", icon: "arrow-up-circle" },
  { id: "cash_drop", label: "COD DROP", icon: "arrow-down-circle" },
  { id: "upi", label: "UPI", icon: "smartphone" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  durationText: string | null;
  fare: number;
  onCreated: (bookingId: string) => void;
};

export default function BookingDetailsSheet({
  visible,
  onClose,
  vehicle,
  pickupAddress,
  dropoffAddress,
  distanceKm,
  durationText,
  fare,
  onCreated,
}: Props) {
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [goodsNote, setGoodsNote] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash_pickup");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSenderPhone("");
      setReceiverName("");
      setReceiverPhone("");
      setGoodsNote("");
      setPayment("cash_pickup");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const validate = (): string | null => {
    const s = senderPhone.replace(/\D/g, "");
    const r = receiverPhone.replace(/\D/g, "");
    if (s.length < 10) return "Enter a valid sender phone (10 digits)";
    if (!receiverName.trim()) return "Receiver name is required";
    if (r.length < 10) return "Enter a valid receiver phone (10 digits)";
    if (!goodsNote.trim()) return "Please describe the goods";
    return null;
  };

  const submit = async () => {
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateBookingInput = {
        vehicle_type: vehicle.id,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        distance_km: distanceKm,
        fare,
        sender_phone: senderPhone.replace(/\D/g, ""),
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.replace(/\D/g, ""),
        goods_note: goodsNote.trim(),
        payment_method: payment,
      };
      const booking = await createBooking(payload);
      onCreated(booking.id);
    } catch (e: any) {
      setError(e?.message || "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet} testID="booking-details-sheet">
            <View style={styles.grabber} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>BOOKING DETAILS</Text>
                <Text style={styles.subtitle}>{"// STEP 2 OF 2"}</Text>
              </View>
              <Pressable onPress={onClose} testID="close-sheet" hitSlop={12} style={styles.closeBtn}>
                <Feather name="x" size={18} color={C.onSurface} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>VEHICLE</Text>
                  <Text style={styles.summaryValue}>{vehicle.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>DISTANCE</Text>
                  <Text style={styles.summaryValue}>{distanceKm.toFixed(2)} KM</Text>
                </View>
                {durationText ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>ETA</Text>
                    <Text style={styles.summaryValue}>{durationText.toUpperCase()}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>FARE</Text>
                  <Text style={[styles.summaryValue, { color: C.brand, fontSize: 18 }]}>
                    ₹{fare.toFixed(2)}
                  </Text>
                </View>
              </View>

              <FieldGroup label="[ SENDER PHONE ]">
                <PhoneInput
                  testID="sender-phone-input"
                  value={senderPhone}
                  onChangeText={setSenderPhone}
                  placeholder="10-DIGIT MOBILE"
                />
              </FieldGroup>

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>{"// RECEIVER"}</Text>
              </View>

              <FieldGroup label="[ RECEIVER NAME ]">
                <StyledInput
                  testID="receiver-name-input"
                  value={receiverName}
                  onChangeText={setReceiverName}
                  placeholder="FULL NAME"
                  autoCapitalize="words"
                />
              </FieldGroup>

              <FieldGroup label="[ RECEIVER PHONE ]">
                <PhoneInput
                  testID="receiver-phone-input"
                  value={receiverPhone}
                  onChangeText={setReceiverPhone}
                  placeholder="10-DIGIT MOBILE"
                />
              </FieldGroup>

              <FieldGroup label="[ GOODS / MATERIAL ]">
                <StyledInput
                  testID="goods-note-input"
                  value={goodsNote}
                  onChangeText={setGoodsNote}
                  placeholder="E.G. 5 FURNITURE BOXES"
                  multiline
                  numberOfLines={2}
                  style={{ minHeight: 60, textAlignVertical: "top" }}
                />
              </FieldGroup>

              <FieldGroup label="[ PAYMENT METHOD ]">
                <View style={styles.paymentRow}>
                  {PAYMENT_OPTIONS.map((opt) => {
                    const active = payment === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        testID={`payment-${opt.id}`}
                        onPress={() => setPayment(opt.id)}
                        style={[styles.paymentOption, active && styles.paymentOptionActive]}
                      >
                        <Feather
                          name={opt.icon}
                          size={18}
                          color={active ? C.onSurfaceInverse : C.onSurface}
                        />
                        <Text
                          style={[styles.paymentText, active && styles.paymentTextActive]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </FieldGroup>

              {error && (
                <View style={styles.errorBox} testID="booking-error">
                  <Text style={styles.errorText}>! {error.toUpperCase()}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                testID="confirm-booking-button"
                onPress={submit}
                disabled={submitting}
                style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color={C.onBrandPrimary} />
                ) : (
                  <Text style={styles.confirmText}>CONFIRM BOOKING →</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StyledInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#999"
      autoCorrect={false}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

function PhoneInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <StyledInput
      keyboardType="phone-pad"
      maxLength={15}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheetWrap: { width: "100%" },
  sheet: {
    backgroundColor: C.surface,
    borderTopWidth: 2,
    borderColor: C.borderStrong,
    maxHeight: "92%",
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    backgroundColor: C.borderStrong,
    marginTop: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.borderStrong,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 20,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 1.2,
    marginTop: 2,
    opacity: 0.6,
  },
  closeBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    padding: 6,
  },
  body: { flexGrow: 0, paddingHorizontal: 16 },

  summary: {
    marginTop: 16,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSecondary,
    padding: 12,
    marginBottom: 20,
    gap: 6,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontFamily: MONO, fontSize: 10, color: C.onSurface, letterSpacing: 1, opacity: 0.7 },
  summaryValue: { fontFamily: MONO, fontSize: 13, fontWeight: "700", color: C.onSurface },

  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 4,
    marginBottom: 12,
    paddingTop: 8,
  },
  sectionDividerText: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 1.5,
    opacity: 0.5,
  },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    fontFamily: MONO,
    fontSize: 14,
    color: C.onSurface,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    backgroundColor: C.surface,
  },

  paymentRow: {
    flexDirection: "row",
    gap: 8,
  },
  paymentOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  paymentOptionActive: {
    backgroundColor: C.surfaceInverse,
  },
  paymentText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "700",
    color: C.onSurface,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  paymentTextActive: { color: C.onSurfaceInverse },

  errorBox: {
    borderWidth: 2,
    borderColor: C.error,
    backgroundColor: "#FFF0F0",
    padding: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  errorText: { fontFamily: MONO, fontSize: 11, color: C.error, letterSpacing: 1 },

  footer: {
    borderTopWidth: 2,
    borderTopColor: C.borderStrong,
    padding: 12,
    backgroundColor: C.surface,
  },
  confirmBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 1,
  },
});
