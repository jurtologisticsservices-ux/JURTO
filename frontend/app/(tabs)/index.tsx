import React from "react";
import { SafeAreaView, View, Text, StyleSheet, Pressable } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Feather } from "@expo/vector-icons";

export default function HomeMapScreen() {
  const initialRegion = {
    latitude: 13.0827,
    longitude: 80.2707,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const customMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#000000" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#000000" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#212121" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3A3A3A" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    // Hide labels for a cleaner Uber-like dark map
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text", stylers: [{ visibility: "off" }] },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          customMapStyle={customMapStyle}
          showsUserLocation={true}
          showsMyLocationButton={false}
        >
          <Marker coordinate={{ latitude: 13.0827, longitude: 80.2707 }}>
            <View style={styles.truckMarker}>
              <Feather name="truck" size={18} color="#111" />
            </View>
          </Marker>
        </MapView>

        {/* Top overlay card */}
        <View style={styles.topCard} pointerEvents="box-none">
          <Text style={styles.topCardText}>Hello Sathish</Text>
        </View>

        {/* Bottom overlay card */}
        <View style={styles.bottomCard} pointerEvents="box-none">
          <Pressable style={styles.whereCard}>
            <Text style={styles.whereText}>Where to?</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1 },
  topCard: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#1A1A1A",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    alignItems: "flex-start",
  },
  topCardText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  bottomCard: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  whereCard: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: "#D4AF37", // gold
    alignItems: "center",
  },
  whereText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  truckMarker: {
    backgroundColor: "#ffffff",
    padding: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eee",
  },
});
