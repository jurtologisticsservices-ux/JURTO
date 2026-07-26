import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";
import { useNotifications } from "@/src/lib/notifications";
import LiveMap from "@/src/components/LiveMap";
import { bookingStore } from "@/src/lib/bookingStore";
import { listAddresses, SavedAddress } from "@/src/lib/api";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedAddress[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocError("Enable location for auto pickup");
          // Default to Chennai center
          setCoords({ lat: 13.0827, lng: 80.2707 });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        setCoords({ lat: 13.0827, lng: 80.2707 });
      }
    })();
    (async () => {
      try {
        const list = await listAddresses();
        setSaved(list);
      } catch {
        // ignore
      }
    })();
  }, []);

  const startBooking = (preset?: SavedAddress) => {
    bookingStore.reset();
    if (coords) {
      bookingStore.updateStop(0, {
        address: "Current location",
        lat: coords.lat,
        lng: coords.lng,
        label: "Pickup",
      });
    }
    if (preset) {
      bookingStore.updateStop(1, {
        address: preset.address,
        lat: preset.lat,
        lng: preset.lng,
        place_id: preset.place_id,
        label: "Drop 1",
      });
    }
    router.push("/booking/stops");
  };

  const mapData = coords
    ? { pickup_lat: coords.lat, pickup_lng: coords.lng, driver_lat: coords.lat, driver_lng: coords.lng }
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>Hello, {user?.name || "there"}</Text>
          <Text style={styles.sub}>Where would you like to send today?</Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications")}
          testID="bell-icon"
          hitSlop={10}
          style={styles.bellWrap}
        >
          <Feather name="bell" size={18} color={C.onSurface} />
          {unreadCount > 0 && (
            <View style={styles.badge} testID="bell-badge">
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.mapWrap}>
          {mapData ? (
            <LiveMap data={mapData} height={220} testID="home-map" />
          ) : (
            <View style={[styles.mapWrap, { height: 220, justifyContent: "center", alignItems: "center" }]}>
              <ActivityIndicator color={C.brand} />
            </View>
          )}
          {locError && <Text style={styles.locErr}>{locError}</Text>}
        </View>

        <Pressable style={styles.whereCard} onPress={() => startBooking()} testID="where-to-card">
          <View style={styles.whereIcon}>
            <Feather name="search" size={18} color={C.onBrand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.whereTitle}>Where to?</Text>
            <Text style={styles.whereSub}>Add drop-off and choose vehicle</Text>
          </View>
          <Feather name="chevron-right" size={22} color={C.onSurfaceTertiary} />
        </Pressable>

        {saved.length > 0 && (
          <View style={{ marginTop: S.lg }}>
            <Text style={styles.sectionLabel}>SAVED PLACES</Text>
            <View style={{ marginHorizontal: S.lg, gap: S.sm }}>
              {saved.slice(0, 3).map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.savedRow}
                  onPress={() => startBooking(s)}
                  testID={`saved-${s.id}`}
                >
                  <View style={styles.savedIcon}>
                    <Feather name={s.label.toLowerCase() === "home" ? "home" : "briefcase"} size={16} color={C.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedLabel}>{s.label}</Text>
                    <Text style={styles.savedAddr} numberOfLines={1}>{s.address}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.onSurfaceTertiary} />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S.lg,
    paddingTop: S.md,
    paddingBottom: S.md,
    gap: S.md,
  },
  greet: { fontFamily: DISPLAY, fontSize: 22, color: C.onSurface, letterSpacing: -0.4 },
  sub: { fontFamily: TEXT, fontSize: 13, color: C.onSurfaceSecondary, marginTop: 2 },
  bellWrap: {
    padding: S.sm,
    borderRadius: R.pill,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.brand,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: TEXT, fontSize: 9, fontWeight: "800", color: C.onBrand },
  mapWrap: {
    marginHorizontal: S.lg,
    borderRadius: R.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  locErr: { fontFamily: TEXT, fontSize: 11, color: C.warning, marginTop: 4, paddingHorizontal: 4 },
  whereCard: {
    marginHorizontal: S.lg,
    marginTop: S.lg,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.brand,
    borderRadius: R.lg,
    padding: S.md,
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
  },
  whereIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  whereTitle: { fontFamily: DISPLAY, fontSize: 18, color: C.onSurface },
  whereSub: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  sectionLabel: {
    fontFamily: TEXT,
    fontSize: 11,
    color: C.onSurfaceTertiary,
    letterSpacing: 2,
    marginHorizontal: S.lg,
    marginBottom: S.sm,
    fontWeight: "600",
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceSecondary,
    borderRadius: R.md,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.border,
    gap: S.md,
  },
  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  savedLabel: { fontFamily: TEXT, fontSize: 14, color: C.onSurface, fontWeight: "600" },
  savedAddr: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
});
