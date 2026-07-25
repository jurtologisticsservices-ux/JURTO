import { useState, useEffect, useRef, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const API = `${BASE_URL}/api`;

// ------ Design tokens (Brutalist LIGHT) ------
const C = {
  surface: "#FFFFFF",
  onSurface: "#111111",
  surfaceSecondary: "#F4F4F0",
  surfaceTertiary: "#EBEBE6",
  surfaceInverse: "#111111",
  onSurfaceInverse: "#FFFFFF",
  brand: "#FF4500",
  brandTertiary: "#FFDCD1",
  onBrandPrimary: "#FFFFFF",
  border: "#E0E0DB",
  borderStrong: "#111111",
  success: "#00B85E",
  error: "#E63946",
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });
const DISPLAY = Platform.select({ ios: "Helvetica", android: "sans-serif-condensed", default: "System" });

type Vehicle = {
  id: "two_wheeler" | "tata_ace" | "bada_dost";
  name: string;
  rate: number;
  capacity: string;
  image: string;
};

const VEHICLES: Vehicle[] = [
  {
    id: "two_wheeler",
    name: "TWO-WHEELER",
    rate: 10,
    capacity: "20 KG",
    image:
      "https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2ODl8MHwxfHNlYXJjaHwxfHxtb3RvcmN5Y2xlJTIwZGVsaXZlcnklMjBib3glMjBsb2dpc3RpY3N8ZW58MHx8fHwxNzg0OTkzOTQ1fDA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "tata_ace",
    name: "TATA ACE",
    rate: 20,
    capacity: "750 KG",
    image:
      "https://images.unsplash.com/photo-1601467995997-ac1ae9a8fff4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwxfHxtaW5pJTIwdHJ1Y2slMjBsb2dpc3RpY3MlMjBjYXJnb3xlbnwwfHx8fDE3ODQ5OTM5NDV8MA&ixlib=rb-4.1.0&q=85",
  },
  {
    id: "bada_dost",
    name: "BADA DOST",
    rate: 30,
    capacity: "1500 KG",
    image:
      "https://images.unsplash.com/photo-1616432043562-3671ea2e5242?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxsYXJnZSUyMGNhcmdvJTIwdHJ1Y2slMjBsb2dpc3RpY3N8ZW58MHx8fHwxNzg0OTkzOTQ1fDA&ixlib=rb-4.1.0&q=85",
  },
];

type Suggestion = { placeId: string; text: string };
type SelectedPlace = { placeId: string; text: string };

export default function Index() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>(VEHICLES[0]);

  const [pickupInput, setPickupInput] = useState("");
  const [dropoffInput, setDropoffInput] = useState("");
  const [pickupPlace, setPickupPlace] = useState<SelectedPlace | null>(null);
  const [dropoffPlace, setDropoffPlace] = useState<SelectedPlace | null>(null);
  const [pickupHits, setPickupHits] = useState<Suggestion[]>([]);
  const [dropoffHits, setDropoffHits] = useState<Suggestion[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "dropoff" | null>(null);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  // Debounce autocomplete
  const pickupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string): Promise<Suggestion[]> => {
    try {
      const res = await fetch(`${API}/maps/autocomplete?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.suggestions ?? [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (pickupPlace && pickupInput === pickupPlace.text) return;
    if (pickupDebounce.current) clearTimeout(pickupDebounce.current);
    if (pickupInput.trim().length < 3) {
      setPickupHits([]);
      return;
    }
    setAutocompleteLoading(true);
    pickupDebounce.current = setTimeout(async () => {
      const res = await fetchSuggestions(pickupInput.trim());
      setPickupHits(res);
      setAutocompleteLoading(false);
    }, 350);
  }, [pickupInput, pickupPlace, fetchSuggestions]);

  useEffect(() => {
    if (dropoffPlace && dropoffInput === dropoffPlace.text) return;
    if (dropoffDebounce.current) clearTimeout(dropoffDebounce.current);
    if (dropoffInput.trim().length < 3) {
      setDropoffHits([]);
      return;
    }
    setAutocompleteLoading(true);
    dropoffDebounce.current = setTimeout(async () => {
      const res = await fetchSuggestions(dropoffInput.trim());
      setDropoffHits(res);
      setAutocompleteLoading(false);
    }, 350);
  }, [dropoffInput, dropoffPlace, fetchSuggestions]);

  // Compute distance whenever both places selected
  useEffect(() => {
    if (!pickupPlace || !dropoffPlace) {
      setDistanceKm(null);
      setDistanceError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDistanceLoading(true);
      setDistanceError(null);
      try {
        const url = `${API}/maps/distance-km?origin=${encodeURIComponent(pickupPlace.placeId)}&destination=${encodeURIComponent(dropoffPlace.placeId)}`;
        const res = await fetch(url);
        if (!res.ok) {
          setDistanceError("Could not calculate distance");
          setDistanceKm(null);
        } else {
          const data = await res.json();
          if (!cancelled) setDistanceKm(data.distance_km);
        }
      } catch {
        if (!cancelled) setDistanceError("Network error");
      } finally {
        if (!cancelled) setDistanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupPlace, dropoffPlace]);

  const fare = distanceKm != null ? Math.round(distanceKm * selectedVehicle.rate * 100) / 100 : null;

  const canBook = pickupPlace && dropoffPlace && distanceKm != null && !distanceLoading;

  const handleSelectSuggestion = (s: Suggestion) => {
    if (activeField === "pickup") {
      setPickupPlace(s);
      setPickupInput(s.text);
      setPickupHits([]);
    } else if (activeField === "dropoff") {
      setDropoffPlace(s);
      setDropoffInput(s.text);
      setDropoffHits([]);
    }
    setActiveField(null);
    Keyboard.dismiss();
  };

  const clearPickup = () => {
    setPickupInput("");
    setPickupPlace(null);
    setPickupHits([]);
  };
  const clearDropoff = () => {
    setDropoffInput("");
    setDropoffPlace(null);
    setDropoffHits([]);
  };

  const handleBookingConfirmed = (bookingId: string) => {
    setConfirmedBookingId(bookingId);
    setShowBookingForm(false);
    setShowSuccess(true);
  };

  const resetAll = () => {
    setShowSuccess(false);
    setConfirmedBookingId(null);
    clearPickup();
    clearDropoff();
    setSelectedVehicle(VEHICLES[0]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header} testID="app-header">
        <Text style={styles.headerTitle}>SHIFT</Text>
        <Text style={styles.headerSubtitle}>// LOGISTICS BOOKING</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Vehicle selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ SELECT VEHICLE ]</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vehicleRow}
          >
            {VEHICLES.map((v) => {
              const active = selectedVehicle.id === v.id;
              return (
                <Pressable
                  key={v.id}
                  testID={`vehicle-${v.id}`}
                  onPress={() => setSelectedVehicle(v)}
                  style={[styles.vehicleCard, active && styles.vehicleCardActive]}
                >
                  <View style={styles.vehicleImageWrap}>
                    <Image source={{ uri: v.image }} style={styles.vehicleImage} contentFit="cover" />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={[styles.vehicleName, active && styles.vehicleNameActive]}>{v.name}</Text>
                    <Text style={[styles.vehicleMeta, active && styles.vehicleMetaActive]}>
                      {v.capacity}
                    </Text>
                    <View style={styles.vehicleRateBox}>
                      <Text style={[styles.vehicleRate, active && styles.vehicleRateActive]}>
                        ₹{v.rate}/KM
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ ROUTE ]</Text>

          <AddressField
            label="[ PICKUP ]"
            testID="pickup-input"
            value={pickupInput}
            onChangeText={(t) => {
              setPickupInput(t);
              if (pickupPlace && t !== pickupPlace.text) setPickupPlace(null);
            }}
            onFocus={() => setActiveField("pickup")}
            onClear={clearPickup}
          />
          {activeField === "pickup" && pickupHits.length > 0 && (
            <View style={styles.dropdown} testID="pickup-suggestions">
              {pickupHits.map((s) => (
                <Pressable
                  key={s.placeId}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectSuggestion(s)}
                  testID={`pickup-suggestion-${s.placeId}`}
                >
                  <Feather name="map-pin" size={14} color={C.onSurface} />
                  <Text style={styles.dropdownItemText} numberOfLines={2}>
                    {s.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.routeConnector}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, styles.routeDotEnd]} />
          </View>

          <AddressField
            label="[ DROP-OFF ]"
            testID="dropoff-input"
            value={dropoffInput}
            onChangeText={(t) => {
              setDropoffInput(t);
              if (dropoffPlace && t !== dropoffPlace.text) setDropoffPlace(null);
            }}
            onFocus={() => setActiveField("dropoff")}
            onClear={clearDropoff}
          />
          {activeField === "dropoff" && dropoffHits.length > 0 && (
            <View style={styles.dropdown} testID="dropoff-suggestions">
              {dropoffHits.map((s) => (
                <Pressable
                  key={s.placeId}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectSuggestion(s)}
                  testID={`dropoff-suggestion-${s.placeId}`}
                >
                  <Feather name="map-pin" size={14} color={C.onSurface} />
                  <Text style={styles.dropdownItemText} numberOfLines={2}>
                    {s.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {autocompleteLoading && (
            <View style={styles.inlineLoading} testID="autocomplete-loading">
              <ActivityIndicator size="small" color={C.onSurface} />
              <Text style={styles.inlineLoadingText}>SEARCHING…</Text>
            </View>
          )}
        </View>

        {/* Fare summary */}
        <View style={styles.fareBlock} testID="fare-summary">
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>DISTANCE</Text>
            <Text style={styles.fareValue} testID="distance-value">
              {distanceLoading
                ? "…"
                : distanceKm != null
                ? `${distanceKm.toFixed(2)} KM`
                : "-- KM"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>RATE</Text>
            <Text style={styles.fareValue}>₹{selectedVehicle.rate}/KM</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, styles.fareTotalLabel]}>TOTAL</Text>
            <Text style={[styles.fareValue, styles.fareTotalValue]} testID="fare-value">
              {fare != null ? `₹${fare.toFixed(2)}` : "₹--"}
            </Text>
          </View>
          {distanceError && (
            <View style={styles.errorBox} testID="distance-error">
              <Text style={styles.errorText}>! {distanceError}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Book Now */}
      <View style={styles.bookNowWrap}>
        <Pressable
          testID="book-now-button"
          disabled={!canBook}
          onPress={() => setShowBookingForm(true)}
          style={[styles.bookNowBtn, !canBook && styles.bookNowBtnDisabled]}
        >
          <Text style={styles.bookNowText}>
            {distanceLoading ? "CALCULATING…" : "BOOK NOW →"}
          </Text>
        </Pressable>
      </View>

      {/* Booking form modal */}
      <BookingFormModal
        visible={showBookingForm}
        onClose={() => setShowBookingForm(false)}
        vehicle={selectedVehicle}
        pickup={pickupPlace?.text ?? ""}
        dropoff={dropoffPlace?.text ?? ""}
        distanceKm={distanceKm ?? 0}
        fare={fare ?? 0}
        onConfirmed={handleBookingConfirmed}
      />

      {/* Success modal */}
      <SuccessModal
        visible={showSuccess}
        bookingId={confirmedBookingId}
        vehicleName={selectedVehicle.name}
        fare={fare ?? 0}
        distanceKm={distanceKm ?? 0}
        onDone={resetAll}
      />
    </SafeAreaView>
  );
}

// ------- Address input field -------
function AddressField({
  label,
  value,
  onChangeText,
  onFocus,
  onClear,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onFocus: () => void;
  onClear: () => void;
  testID: string;
}) {
  return (
    <View style={styles.addressFieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder="ENTER ADDRESS"
          placeholderTextColor="#999"
          style={styles.input}
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={onClear} testID={`${testID}-clear`} style={styles.clearBtn} hitSlop={10}>
            <Feather name="x" size={16} color={C.onSurface} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ------- Booking Form Modal -------
function BookingFormModal({
  visible,
  onClose,
  vehicle,
  pickup,
  dropoff,
  distanceKm,
  fare,
  onConfirmed,
}: {
  visible: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  pickup: string;
  dropoff: string;
  distanceKm: number;
  fare: number;
  onConfirmed: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setName("");
      setPhone("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name required");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return setError("Enter valid 10-digit phone");

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: digits,
          vehicle_type: vehicle.id,
          pickup_address: pickup,
          dropoff_address: dropoff,
          distance_km: distanceKm,
          fare,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        setError(t || "Booking failed");
      } else {
        const data = await res.json();
        onConfirmed(data.id);
      }
    } catch (e: any) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%" }}
          >
            <View style={styles.modalCard} testID="booking-form-modal">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>CONFIRM BOOKING</Text>
                <Pressable onPress={onClose} testID="close-booking-form" hitSlop={10}>
                  <Feather name="x" size={20} color={C.onSurface} />
                </Pressable>
              </View>

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>VEHICLE</Text>
                  <Text style={styles.summaryValue}>{vehicle.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>DISTANCE</Text>
                  <Text style={styles.summaryValue}>{distanceKm.toFixed(2)} KM</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>FARE</Text>
                  <Text style={[styles.summaryValue, { color: C.brand }]}>₹{fare.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>[ NAME ]</Text>
                <TextInput
                  testID="name-input"
                  value={name}
                  onChangeText={setName}
                  placeholder="FULL NAME"
                  placeholderTextColor="#999"
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>[ PHONE ]</Text>
                <TextInput
                  testID="phone-input"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="10-DIGIT MOBILE"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  style={styles.input}
                  maxLength={15}
                />
              </View>

              {error && (
                <View style={styles.errorBox} testID="booking-form-error">
                  <Text style={styles.errorText}>! {error.toUpperCase()}</Text>
                </View>
              )}

              <Pressable
                testID="confirm-booking-button"
                onPress={submit}
                disabled={submitting}
                style={[styles.submitBtn, submitting && styles.bookNowBtnDisabled]}
              >
                {submitting ? (
                  <ActivityIndicator color={C.onBrandPrimary} />
                ) : (
                  <Text style={styles.submitBtnText}>CONFIRM →</Text>
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ------- Success Modal -------
function SuccessModal({
  visible,
  bookingId,
  vehicleName,
  fare,
  distanceKm,
  onDone,
}: {
  visible: boolean;
  bookingId: string | null;
  vehicleName: string;
  fare: number;
  distanceKm: number;
  onDone: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDone}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} testID="booking-success">
          <View style={styles.successIconWrap}>
            <Feather name="check" size={32} color={C.onSurface} />
          </View>
          <Text style={styles.successTitle}>BOOKING CONFIRMED</Text>
          <Text style={styles.successSub}>DISPATCH INCOMING</Text>

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ID</Text>
              <Text style={[styles.summaryValue, { fontSize: 11 }]} numberOfLines={1}>
                {bookingId?.slice(0, 8).toUpperCase() ?? "--"}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>VEHICLE</Text>
              <Text style={styles.summaryValue}>{vehicleName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>DISTANCE</Text>
              <Text style={styles.summaryValue}>{distanceKm.toFixed(2)} KM</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>FARE</Text>
              <Text style={[styles.summaryValue, { color: C.brand }]}>₹{fare.toFixed(2)}</Text>
            </View>
          </View>

          <Pressable onPress={onDone} style={styles.submitBtn} testID="new-booking-button">
            <Text style={styles.submitBtnText}>NEW BOOKING</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ------- Styles -------
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
  headerTitle: {
    fontFamily: DISPLAY,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: C.onSurface,
  },
  headerSubtitle: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.onSurface,
    letterSpacing: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.onSurface,
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  vehicleRow: { gap: 12, paddingRight: 16 },
  vehicleCard: {
    width: 160,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
  },
  vehicleCardActive: {
    backgroundColor: C.surfaceInverse,
  },
  vehicleImageWrap: {
    width: "100%",
    height: 90,
    borderBottomWidth: 2,
    borderBottomColor: C.borderStrong,
    backgroundColor: C.surfaceSecondary,
  },
  vehicleImage: { width: "100%", height: "100%" },
  vehicleInfo: { padding: 10 },
  vehicleName: {
    fontFamily: DISPLAY,
    fontSize: 14,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  vehicleNameActive: { color: C.onSurfaceInverse },
  vehicleMeta: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    marginTop: 4,
    opacity: 0.7,
  },
  vehicleMetaActive: { color: C.onSurfaceInverse, opacity: 0.6 },
  vehicleRateBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  vehicleRate: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: "700",
    color: C.brand,
  },
  vehicleRateActive: { color: C.brand },

  addressFieldWrap: { marginBottom: 4 },
  fieldLabel: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
  },
  input: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 14,
    color: C.onSurface,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: C.borderStrong,
  },

  dropdown: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    maxHeight: 260,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  dropdownItemText: {
    flex: 1,
    fontFamily: MONO,
    fontSize: 12,
    color: C.onSurface,
    lineHeight: 16,
  },

  routeConnector: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    marginLeft: 4,
    flexDirection: "row",
    gap: 6,
  },
  routeDot: {
    width: 6,
    height: 6,
    backgroundColor: C.brand,
  },
  routeDotEnd: { backgroundColor: C.onSurface },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.borderStrong,
  },

  inlineLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  inlineLoadingText: {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 1,
    color: C.onSurface,
  },

  fareBlock: {
    marginTop: 24,
    marginHorizontal: 16,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSecondary,
    padding: 16,
  },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  fareLabel: {
    fontFamily: MONO,
    fontSize: 12,
    color: C.onSurface,
    letterSpacing: 1,
  },
  fareValue: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: "700",
    color: C.onSurface,
  },
  fareTotalLabel: { fontSize: 14, fontWeight: "900" },
  fareTotalValue: {
    fontSize: 28,
    color: C.brand,
    fontWeight: "900",
  },
  divider: { height: 1, backgroundColor: C.borderStrong, opacity: 0.15 },

  errorBox: {
    marginTop: 10,
    borderWidth: 2,
    borderColor: C.error,
    padding: 10,
    backgroundColor: "#FFF0F0",
  },
  errorText: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.error,
    letterSpacing: 1,
  },

  bookNowWrap: {
    borderTopWidth: 2,
    borderTopColor: C.borderStrong,
    backgroundColor: C.surface,
    padding: 12,
  },
  bookNowBtn: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bookNowBtnDisabled: {
    backgroundColor: C.surfaceTertiary,
  },
  bookNowText: {
    fontFamily: DISPLAY,
    fontSize: 16,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 1,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.borderStrong,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: DISPLAY,
    fontSize: 20,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: -0.3,
  },
  summaryBox: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceSecondary,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: MONO,
    fontSize: 10,
    color: C.onSurface,
    letterSpacing: 1,
    opacity: 0.7,
  },
  summaryValue: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: "700",
    color: C.onSurface,
  },
  formGroup: { marginBottom: 12 },
  submitBtn: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnText: {
    fontFamily: DISPLAY,
    fontSize: 15,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 1,
  },

  successIconWrap: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  successTitle: {
    fontFamily: DISPLAY,
    fontSize: 22,
    fontWeight: "900",
    color: C.onSurface,
    textAlign: "center",
  },
  successSub: {
    fontFamily: MONO,
    fontSize: 11,
    color: C.onSurface,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    opacity: 0.6,
  },
});
