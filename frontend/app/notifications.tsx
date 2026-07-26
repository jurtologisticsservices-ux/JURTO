import { useEffect } from "react";
import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { C, MONO, DISPLAY } from "@/src/lib/theme";
import { useNotifications } from "@/src/lib/notifications";
import { Notification } from "@/src/lib/api";

function relTime(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000) return "JUST NOW";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}M AGO`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}H AGO`;
    return `${Math.floor(diff / 86400_000)}D AGO`;
  } catch {
    return "";
  }
}

const TYPE_META: Record<
  Notification["type"],
  { icon: keyof typeof Feather.glyphMap; color: string }
> = {
  BOOKING_CONFIRMED: { icon: "package", color: C.brand },
  STATUS_ASSIGNED: { icon: "user-check", color: C.warning },
  STATUS_PICKED_UP: { icon: "truck", color: C.warning },
  STATUS_DELIVERED: { icon: "check-circle", color: C.success },
  STATUS_CANCELLED: { icon: "x-circle", color: C.error },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, markAllRead, clearAll, connected } = useNotifications();

  useEffect(() => {
    // Mark all read whenever this screen opens
    markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} testID="back-button" hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={C.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>NOTIFICATIONS</Text>
          <View style={styles.subRow}>
            <View style={[styles.connDot, { backgroundColor: connected ? C.success : C.warning }]} />
            <Text style={styles.subtitle}>{connected ? "LIVE" : "CONNECTING…"}</Text>
          </View>
        </View>
        {notifications.length > 0 && (
          <Pressable
            testID="clear-all-button"
            onPress={clearAll}
            hitSlop={10}
            style={styles.clearBtn}
          >
            <Feather name="trash-2" size={14} color={C.onSurface} />
            <Text style={styles.clearText}>CLEAR</Text>
          </Pressable>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty} testID="notifications-empty">
          <View style={styles.emptyIcon}>
            <Feather name="bell-off" size={22} color={C.onSurface} />
          </View>
          <Text style={styles.emptyTitle}>NO NOTIFICATIONS YET</Text>
          <Text style={styles.emptyBody}>
            Booking updates, driver assignments, and delivery confirmations will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = TYPE_META[item.type] ?? TYPE_META.BOOKING_CONFIRMED;
            return (
              <Pressable
                style={styles.row}
                testID={`notif-${item.id}`}
                onPress={() => item.order_id && router.push(`/tracking/${item.order_id}`)}
              >
                <View style={[styles.rowIcon, { backgroundColor: meta.color }]}>
                  <Feather name={meta.icon} size={16} color={C.onSurface} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title.toUpperCase()}
                    </Text>
                    <Text style={styles.rowTime}>{relTime(item.created_at)}</Text>
                  </View>
                  <Text style={styles.rowText} numberOfLines={3}>
                    {item.body}
                  </Text>
                  {item.vehicle_number ? (
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{item.vehicle_number}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  topBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
  },
  backBtn: { borderWidth: 2, borderColor: C.borderStrong, padding: 6 },
  title: { fontFamily: DISPLAY, fontSize: 18, fontWeight: "900", color: C.onSurface, letterSpacing: -0.3 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  connDot: { width: 6, height: 6 },
  subtitle: { fontFamily: MONO, fontSize: 10, color: C.onSurface, letterSpacing: 1, opacity: 0.7 },

  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: C.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: C.surfaceSecondary,
  },
  clearText: { fontFamily: MONO, fontSize: 10, fontWeight: "900", color: C.onSurface, letterSpacing: 1 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surfaceSecondary,
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: DISPLAY, fontSize: 16, fontWeight: "900", color: C.onSurface, letterSpacing: -0.2 },
  emptyBody: {
    fontFamily: MONO,
    fontSize: 12,
    color: C.onSurface,
    textAlign: "center",
    lineHeight: 16,
    opacity: 0.6,
  },

  list: { padding: 12 },
  row: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    padding: 10,
    flexDirection: "row",
    gap: 10,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 4 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowTitle: {
    flex: 1,
    fontFamily: DISPLAY,
    fontSize: 13,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: -0.2,
  },
  rowTime: { fontFamily: MONO, fontSize: 10, color: C.onSurface, opacity: 0.6, letterSpacing: 0.5 },
  rowText: { fontFamily: MONO, fontSize: 11, color: C.onSurface, lineHeight: 15 },
  plate: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: C.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.warning,
    marginTop: 4,
  },
  plateText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: "900",
    color: C.onSurface,
    letterSpacing: 1,
  },
});
