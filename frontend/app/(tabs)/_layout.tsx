import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, TEXT } from "@/src/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: C.surfaceSecondary,
          borderTopWidth: 1,
          borderTopColor: C.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: TEXT, fontSize: 10, fontWeight: "600", letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "HOME", tabBarIcon: ({ color }) => <Feather name="map-pin" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "ORDERS", tabBarIcon: ({ color }) => <Feather name="package" size={20} color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "ACCOUNT", tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} /> }}
      />
    </Tabs>
  );
}
