import { View, Text, StyleSheet, Pressable, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S } from "@/src/lib/theme";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.container} testID="welcome-screen">
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1685625971503-ef1f82128939?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGRhcmslMjBjaGFyY29hbCUyMGdvbGQlMjB0ZXh0dXJlfGVufDB8fHx8MTc4NTA5MjU2Mnww&ixlib=rb-4.1.0&q=85",
        }}
        style={styles.bg}
      >
        <LinearGradient
          colors={["rgba(18,18,18,0.15)", "rgba(18,18,18,0.85)", C.surface]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.top}>
            <Text style={styles.brandMark}>LUXE</Text>
            <Text style={styles.brandSub}>LOGISTICS · CHENNAI</Text>
          </View>
          <View style={styles.bottom}>
            <Text style={styles.headline}>Move anything.{"\n"}Anywhere in the city.</Text>
            <Text style={styles.subhead}>
              Premium goods transport from Two-Wheeler to 17ft trucks — booked in seconds.
            </Text>
            <Pressable
              testID="get-started-button"
              style={styles.cta}
              onPress={() => router.push("/auth/phone")}
            >
              <Text style={styles.ctaText}>GET STARTED</Text>
            </Pressable>
            <Text style={styles.foot}>By continuing you accept our Terms & Privacy.</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  bg: { flex: 1 },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: S.xl },
  top: { paddingTop: S.xxl, alignItems: "flex-start" },
  brandMark: { fontFamily: DISPLAY, fontSize: 40, color: C.brand, fontWeight: "700", letterSpacing: 2 },
  brandSub: { fontFamily: TEXT, fontSize: 11, color: C.onSurface, letterSpacing: 3, marginTop: 4, opacity: 0.8 },
  bottom: { gap: S.md, paddingBottom: S.md },
  headline: { fontFamily: DISPLAY, fontSize: 32, color: C.onSurface, lineHeight: 40, letterSpacing: -0.5 },
  subhead: { fontFamily: TEXT, fontSize: 14, color: C.onSurfaceSecondary, lineHeight: 20, marginBottom: S.md },
  cta: {
    backgroundColor: C.brand,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { fontFamily: TEXT, fontSize: 14, fontWeight: "700", color: C.onBrand, letterSpacing: 2 },
  foot: { fontFamily: TEXT, fontSize: 11, color: C.onSurfaceTertiary, textAlign: "center", opacity: 0.7 },
});
