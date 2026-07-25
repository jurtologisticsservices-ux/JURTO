import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, MONO, DISPLAY } from "@/src/lib/theme";
import { subscribeToast, Toast } from "@/src/lib/notifications";

type Visible = Toast & { anim: Animated.Value };

const TOAST_LIFETIME = 4200; // ms

export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Visible[]>([]);
  const itemsRef = useRef<Visible[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    const unsub = subscribeToast((t) => {
      const anim = new Animated.Value(0);
      const visible: Visible = { ...t, anim };
      setItems((prev) => [...prev, visible].slice(-4));
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
      setTimeout(() => dismiss(visible.id), TOAST_LIFETIME);
    });
    return unsub;
  }, []);

  const dismiss = (id: string) => {
    const cur = itemsRef.current.find((x) => x.id === id);
    if (!cur) return;
    Animated.timing(cur.anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    });
  };

  return (
    <View
      style={[styles.host, { paddingTop: insets.top + 6 }]}
      testID="toast-host"
    >
      {items.map((t) => {
        const bg = t.variant === "success" ? C.success : t.variant === "brand" ? C.brand : C.onSurface;
        const fg = t.variant === "info" ? C.onSurfaceInverse : C.onBrandPrimary;
        const icon: keyof typeof Feather.glyphMap =
          t.variant === "success" ? "check-circle" : t.variant === "brand" ? "package" : "bell";
        return (
          <Animated.View
            key={t.id}
            style={[
              styles.toast,
              {
                backgroundColor: bg,
                opacity: t.anim,
                transform: [
                  {
                    translateY: t.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-32, 0],
                    }),
                  },
                ],
              },
            ]}
            testID={`toast-${t.variant}`}
          >
            <View style={styles.iconWrap}>
              <Feather name={icon} size={16} color={fg} />
            </View>
            <View style={styles.body}>
              <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
                {t.title.toUpperCase()}
              </Text>
              <Text style={[styles.text, { color: fg }]} numberOfLines={2}>
                {t.body}
              </Text>
            </View>
            <Pressable onPress={() => dismiss(t.id)} hitSlop={10} style={styles.closeBtn}>
              <Feather name="x" size={14} color={fg} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    gap: 8,
    paddingHorizontal: 12,
    pointerEvents: "box-none",
  },
  toast: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    borderWidth: 2,
    borderColor: C.borderStrong,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  body: { flex: 1 },
  title: {
    fontFamily: DISPLAY,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  text: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
    opacity: 0.9,
  },
  closeBtn: { padding: 4 },
});
