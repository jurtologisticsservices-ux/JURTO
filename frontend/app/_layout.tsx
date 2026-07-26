import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/lib/auth";
import { NotificationsProvider } from "@/src/lib/notifications";
import ToastHost from "@/src/components/ToastHost";
import { C } from "@/src/lib/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const first = segments[0] ?? "";
    const inAuthFlow = first === "welcome" || first === "auth";
    if (!user && !inAuthFlow) {
      router.replace("/welcome");
    } else if (user && (first === "welcome" || first === "auth")) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationsProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: C.surface }}>
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "fade",
                  contentStyle: { backgroundColor: C.surface },
                }}
              >
                <Stack.Screen name="welcome" />
                <Stack.Screen name="auth/phone" />
                <Stack.Screen name="auth/otp" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="booking/stops" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="booking/vehicle" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="booking/summary" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="tracking/[id]" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="account/addresses" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="account/gst" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="account/refer" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="account/help" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="account/terms" options={{ animation: "slide_from_right" }} />
              </Stack>
            </AuthGate>
            <ToastHost />
          </View>
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
