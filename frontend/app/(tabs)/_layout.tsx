import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, MONO } from "@/src/lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.onSurface,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopWidth: 2,
          borderTopColor: C.borderStrong,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: 1,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "BOOK",
          tabBarIcon: ({ color }) => <Feather name="package" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-bookings"
        options={{
          title: "MY BOOKINGS",
          tabBarIcon: ({ color }) => <Feather name="list" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
