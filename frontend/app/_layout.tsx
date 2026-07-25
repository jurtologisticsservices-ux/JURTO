import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { NotificationsProvider } from "@/src/lib/notifications";
import ToastHost from "@/src/components/ToastHost";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <NotificationsProvider>
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="tracking/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="driver/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="notifications" options={{ presentation: "card" }} />
          </Stack>
          <ToastHost />
        </View>
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
