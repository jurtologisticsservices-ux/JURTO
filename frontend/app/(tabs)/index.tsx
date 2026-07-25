import { useState, useEffect, useRef, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, MONO, DISPLAY } from "@/src/lib/theme";
import {
  VEHICLES,
  Vehicle,
  Suggestion,
  fetchSuggestions,
  fetchDistance,
} from "@/src/lib/api";
import BookingDetailsSheet from "@/src/components/BookingDetailsSheet";
import BellIcon from "@/src/components/BellIcon";

type SelectedPlace = { placeId: string; text: string };

export default function BookingScreen() {
  const router = useRouter();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>(VEHICLES[0]);

  const [pickupInput, setPickupInput] = useState("");
  const [dropoffInput, setDropoffInput] = useState("");
  const [pickupPlace, setPickupPlace] = useState<SelectedPlace | null>(null);
  const [dropoffPlace, setDropoffPlace] = useState<SelectedPlace | null>(null);
  const [pickupHits, setPickupHits] = useState<Suggestion[]>([]);
  const [dropoffHits, setDropoffHits] = useState<Suggestion[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "dropoff" | null>(null);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationText, setDurationText] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);

  const [showBookingSheet, setShowBookingSheet] = useState(false);

  const pickupDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSuggest = useCallback(
    async (q: string, setter: (s: Suggestion[]) => void) => {
      try {
        setAutocompleteLoading(true);
        const list = await fetchSuggestions(q);
        setter(list);
        setAutocompleteError(null);
      } catch (e: any) {
        setter([]);
        setAutocompleteError(e?.message || "Address search failed");
      } finally {
        setAutocompleteLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (pickupPlace && pickupInput === pickupPlace.text) return;
    if (pickupDebounce.current) clearTimeout(pickupDebounce.current);
    if (pickupInput.trim().length < 3) {
      setPickupHits([]);
      return;
    }
    pickupDebounce.current = setTimeout(() => runSuggest(pickupInput.trim(), setPickupHits), 350);
  }, [pickupInput, pickupPlace, runSuggest]);

  useEffect(() => {
    if (dropoffPlace && dropoffInput === dropoffPlace.text) return;
    if (dropoffDebounce.current) clearTimeout(dropoffDebounce.current);
    if (dropoffInput.trim().length < 3) {
      setDropoffHits([]);
      return;
    }
    dropoffDebounce.current = setTimeout(() => runSuggest(dropoffInput.trim(), setDropoffHits), 350);
  }, [dropoffInput, dropoffPlace, runSuggest]);

  useEffect(() => {
    if (!pickupPlace || !dropoffPlace) {
      setDistanceKm(null);
      setDurationText(null);
      setDistanceError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDistanceLoading(true);
      setDistanceError(null);
      try {
        const data = await fetchDistance(pickupPlace.placeId, dropoffPlace.placeId);
        if (!cancelled) {
          setDistanceKm(data.distance_km);
          setDurationText(data.duration_text ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setDistanceError(e?.message || "Could not calculate distance");
          setDistanceKm(null);
          setDurationText(null);
        }
      } finally {
        if (!cancelled) setDistanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupPlace, dropoffPlace]);

  const fare = distanceKm != null ? Math.round(distanceKm * selectedVehicle.rate * 100) / 100 : null;
  const canProceed = !!pickupPlace && !!dropoffPlace && distanceKm != null && !distanceLoading;

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

  const handleBookingCreated = (bookingId: string) => {
    setShowBookingSheet(false);
    // Reset the form so user comes back to a clean state
    clearPickup();
    clearDropoff();
    setSelectedVehicle(VEHICLES[0]);
    router.push(`/tracking/${bookingId}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header} testID="app-header">
        <View>
          <Text style={styles.headerTitle}>SHIFT</Text>
          <Text style={styles.headerSubtitle}>{"// LOGISTICS"}</Text>
        </View>
        <BellIcon />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>[ SELECT VEHICLE ]</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleRow}>
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
                    <Text style={[styles.vehicleMeta, active && styles.vehicleMetaActive]}>{v.capacity}</Text>
                    <View style={styles.vehicleRateBox}>
                      <Text style={styles.vehicleRate}>₹{v.rate}/KM</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

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
                  <Text style={styles.dropdownItemText} numberOfLines={2}>{s.text}</Text>
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
                  <Text style={styles.dropdownItemText} numberOfLines={2}>{s.text}</Text>
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
          {autocompleteError && !autocompleteLoading && (
            <View style={styles.errorBox} testID="autocomplete-error">
              <Text style={styles.errorText}>! {autocompleteError.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.fareBlock} testID="fare-summary">
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>DISTANCE</Text>
            <Text style={styles.fareValue} testID="distance-value">
              {distanceLoading ? "…" : distanceKm != null ? `${distanceKm.toFixed(2)} KM` : "-- KM"}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>ETA</Text>
            <Text style={styles.fareValue} testID="duration-value">
              {durationText ? durationText.toUpperCase() : "--"}
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
              <Text style={styles.errorText}>! {distanceError.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.proceedWrap}>
        <Pressable
          testID="proceed-button"
          disabled={!canProceed}
          onPress={() => setShowBookingSheet(true)}
          style={[styles.proceedBtn, !canProceed && styles.proceedBtnDisabled]}
        >
          <Text style={styles.proceedText}>
            {distanceLoading ? "CALCULATING…" : "PROCEED →"}
          </Text>
        </Pressable>
      </View>

      <BookingDetailsSheet
        visible={showBookingSheet}
        onClose={() => setShowBookingSheet(false)}
        vehicle={selectedVehicle}
        pickupAddress={pickupPlace?.text ?? ""}
        dropoffAddress={dropoffPlace?.text ?? ""}
        distanceKm={distanceKm ?? 0}
        durationText={durationText}
        fare={fare ?? 0}
        onCreated={handleBookingCreated}
      />
    </SafeAreaView>
  );
}

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
  headerTitle: { fontFamily: DISPLAY, fontSize: 28, fontWeight: "900", letterSpacing: -0.5, color: C.onSurface },
  headerSubtitle: { fontFamily: MONO, fontSize: 11, color: C.onSurface, letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { fontFamily: MONO, fontSize: 11, color: C.onSurface, letterSpacing: 1.5, marginBottom: 12 },
  vehicleRow: { gap: 12, paddingRight: 16 },
  vehicleCard: { width: 160, borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.surface },
  vehicleCardActive: { backgroundColor: C.surfaceInverse },
  vehicleImageWrap: { width: "100%", height: 90, borderBottomWidth: 2, borderBottomColor: C.borderStrong, backgroundColor: C.surfaceSecondary },
  vehicleImage: { width: "100%", height: "100%" },
  vehicleInfo: { padding: 10 },
  vehicleName: { fontFamily: DISPLAY, fontSize: 14, fontWeight: "900", color: C.onSurface, letterSpacing: -0.3 },
  vehicleNameActive: { color: C.onSurfaceInverse },
  vehicleMeta: { fontFamily: MONO, fontSize: 10, color: C.onSurface, marginTop: 4, opacity: 0.7 },
  vehicleMetaActive: { color: C.onSurfaceInverse, opacity: 0.6 },
  vehicleRateBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  vehicleRate: { fontFamily: MONO, fontSize: 13, fontWeight: "700", color: C.brand },
  addressFieldWrap: { marginBottom: 4 },
  fieldLabel: { fontFamily: MONO, fontSize: 10, color: C.onSurface, letterSpacing: 1.2, marginBottom: 6 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.surface },
  input: { flex: 1, fontFamily: MONO, fontSize: 14, color: C.onSurface, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 14 : 10 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 2, borderLeftColor: C.borderStrong },
  dropdown: { borderWidth: 2, borderTopWidth: 0, borderColor: C.borderStrong, backgroundColor: C.surface, maxHeight: 260 },
  dropdownItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 },
  dropdownItemText: { flex: 1, fontFamily: MONO, fontSize: 12, color: C.onSurface, lineHeight: 16 },
  routeConnector: { height: 20, alignItems: "center", paddingVertical: 6, marginLeft: 4, flexDirection: "row", gap: 6 },
  routeDot: { width: 6, height: 6, backgroundColor: C.brand },
  routeDotEnd: { backgroundColor: C.onSurface },
  routeLine: { flex: 1, height: 2, backgroundColor: C.borderStrong },
  inlineLoading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  inlineLoadingText: { fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: C.onSurface },
  fareBlock: { marginTop: 24, marginHorizontal: 16, borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.surfaceSecondary, padding: 16 },
  fareRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  fareLabel: { fontFamily: MONO, fontSize: 12, color: C.onSurface, letterSpacing: 1 },
  fareValue: { fontFamily: MONO, fontSize: 16, fontWeight: "700", color: C.onSurface },
  fareTotalLabel: { fontSize: 14, fontWeight: "900" },
  fareTotalValue: { fontSize: 28, color: C.brand, fontWeight: "900" },
  divider: { height: 1, backgroundColor: C.borderStrong, opacity: 0.15 },
  errorBox: { marginTop: 10, borderWidth: 2, borderColor: C.error, padding: 10, backgroundColor: "#FFF0F0" },
  errorText: { fontFamily: MONO, fontSize: 11, color: C.error, letterSpacing: 1 },
  proceedWrap: { borderTopWidth: 2, borderTopColor: C.borderStrong, backgroundColor: C.surface, padding: 12 },
  proceedBtn: { borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.brand, paddingVertical: 18, alignItems: "center" },
  proceedBtnDisabled: { backgroundColor: C.surfaceTertiary },
  proceedText: { fontFamily: DISPLAY, fontSize: 16, fontWeight: "900", color: C.onBrandPrimary, letterSpacing: 1 },
});
