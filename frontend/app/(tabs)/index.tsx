import React from "react";
import { SafeAreaView, View, Text, StyleSheet, Pressable, TextInput, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import LiveMap from "@/src/components/LiveMap";

export default function Home() {
  // Centered on Kolathur, Chennai
  const center = {
    latitude: 13.1211,
    longitude: 80.2210,
  };

  const mapData = {
    pickup_lat: center.latitude,
    pickup_lng: center.longitude,
  };

  const windowHeight = Dimensions.get("window").height;
  const mapHeight = Math.round(windowHeight * 0.6);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* LiveMap (Leaflet in a WebView) replacing react-native-maps MapView */}
        <View style={styles.mapWrap}>
          <LiveMap data={mapData} height={mapHeight} testID="home-live-map" />
        </View>

        {/* Top search bar + chips (Google Maps like) */}
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.searchBar}>
            <Feather name="map-pin" size={20} color="#DB4437" style={styles.pinIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search here"
              placeholderTextColor="#666"
              underlineColorAndroid="transparent"
            />
          </View>

          <View style={styles.chipsRow}>
            <Pressable style={styles.chip} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
              <Text style={styles.chipText}>Restaurants</Text>
            </Pressable>
            <Pressable style={styles.chip} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
              <Text style={styles.chipText}>Petrol</Text>
            </Pressable>
            <Pressable style={styles.chip} android_ripple={{ color: "rgba(0,0,0,0.06)" }}>
              <Text style={styles.chipText}>Hotels</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  mapWrap: { flex: 1 },
  topOverlay: {
    position: "absolute",
    top: 40,
    left: 12,
    right: 12,
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pinIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#111" },
  chipsRow: {
    marginTop: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chip: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    alignItems: "center",
    justifyContent: "center",
    minWidth: 90,
  },
  chipText: { color: "#111", fontSize: 14, fontWeight: "600" },
});
