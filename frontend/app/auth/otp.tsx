import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

export default function OtpAuth() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verify } = useAuth();
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    if (!phone) return;
    const digits = otp.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verify(phone, digits, name.trim() || undefined);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const formatted = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : "";

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-button" hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={C.onSurface} />
          </Pressable>
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, paddingHorizontal: S.xl, justifyContent: "space-between" }}
        >
          <View style={{ marginTop: S.xl }}>
            <Text style={styles.title}>Verify your{"\n"}number</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to {formatted}</Text>

            <TextInput
              testID="otp-input"
              value={otp}
              onChangeText={setOtp}
              placeholder="••••••"
              placeholderTextColor={C.onSurfaceTertiary}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              autoFocus
            />

            <TextInput
              testID="name-input"
              value={name}
              onChangeText={setName}
              placeholder="Your name (optional)"
              placeholderTextColor={C.onSurfaceTertiary}
              style={styles.nameInput}
              autoCapitalize="words"
            />

            {error && (
              <Text style={styles.error} testID="otp-error">{error}</Text>
            )}

            <View style={styles.resendRow}>
              <Text style={styles.resendText}>
                {countdown > 0 ? `Resend in ${countdown}s` : "Didn't get it?"}
              </Text>
              <Pressable
                disabled={countdown > 0}
                onPress={() => setCountdown(30)}
              >
                <Text
                  style={[styles.resendLink, countdown > 0 && { opacity: 0.4 }]}
                >
                  RESEND
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ paddingBottom: S.lg }}>
            <Pressable
              testID="verify-otp-button"
              disabled={busy}
              onPress={submit}
              style={[styles.cta, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color={C.onBrand} />
              ) : (
                <Text style={styles.ctaText}>VERIFY & CONTINUE</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.surface },
  header: { paddingHorizontal: S.md, paddingVertical: S.sm, flexDirection: "row" },
  backBtn: { padding: S.sm, borderRadius: R.pill, backgroundColor: C.surfaceSecondary, width: 40, alignItems: "center" },
  title: { fontFamily: DISPLAY, fontSize: 28, color: C.onSurface, lineHeight: 34, letterSpacing: -0.5 },
  subtitle: { fontFamily: TEXT, fontSize: 14, color: C.onSurfaceSecondary, marginTop: S.md, lineHeight: 20 },
  otpInput: {
    marginTop: S.xl,
    fontFamily: TEXT,
    fontSize: 30,
    color: C.onSurface,
    letterSpacing: 12,
    textAlign: "center",
    backgroundColor: C.surfaceSecondary,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: S.md,
  },
  nameInput: {
    marginTop: S.md,
    fontFamily: TEXT,
    fontSize: 16,
    color: C.onSurface,
    backgroundColor: C.surfaceSecondary,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
  },
  error: { fontFamily: TEXT, fontSize: 12, color: C.error, marginTop: S.sm },
  resendRow: { flexDirection: "row", justifyContent: "space-between", marginTop: S.lg, alignItems: "center" },
  resendText: { fontFamily: TEXT, fontSize: 12, color: C.onSurfaceSecondary },
  resendLink: { fontFamily: TEXT, fontSize: 12, color: C.brand, fontWeight: "700", letterSpacing: 1 },
  cta: {
    backgroundColor: C.brand,
    paddingVertical: 16,
    borderRadius: R.pill,
    alignItems: "center",
  },
  ctaText: { fontFamily: TEXT, fontSize: 13, fontWeight: "700", color: C.onBrand, letterSpacing: 2 },
});
