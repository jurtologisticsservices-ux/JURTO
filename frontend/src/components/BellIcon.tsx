import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, MONO } from "@/src/lib/theme";
import { useNotifications } from "@/src/lib/notifications";

export default function BellIcon() {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      testID="bell-icon"
      style={styles.wrap}
      hitSlop={10}
    >
      <Feather name="bell" size={18} color={C.onSurface} />
      {unreadCount > 0 && (
        <View style={styles.badge} testID="bell-badge">
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    padding: 8,
    backgroundColor: C.surface,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 18,
    height: 18,
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.brand,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: "900",
    color: C.onBrandPrimary,
    letterSpacing: 0.5,
  },
});
