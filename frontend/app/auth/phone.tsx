import { useState } from "react";
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
import { useRouter } from "expo-router";

import { C, DISPLAY, TEXT, S, R } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

export default function PhoneAuth() {
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestOtp(digits);
      router.push({ pathname: "/auth/otp", params: { phone: digits } });
    } catch (e: any) {
      setError(e?.message || "Could not send OTP");
    } finally {
      setBusy(false);
    }
  };

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
            <Text style={styles.title}>Enter your{"\n"}mobile number</Text>
            <Text style={styles.subtitle}>
              We&rsquo;ll send you a one-time password to verify your account.
            </Text>

            <View style={styles.field}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                testID="phone-input"
                value={phone}
                onChangeText={setPhone}
                placeholder="98765 43210"
                placeholderTextColor={C.onSurfaceTertiary}
                keyboardType="phone-pad"
                maxLength={12}
                style={styles.input}
                autoFocus
              />
            </View>

            {error && (
              <Text style={styles.error} testID="phone-error">{error}</Text>
            )}
          </View>

          <View style={{ paddingBottom: S.lg }}>
            <Pressable
              testID="send-otp-button"
              disabled={busy}
              onPress={submit}
              style={[styles.cta, busy && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color={C.onBrand} />
              ) : (
                <Text style={styles.ctaText}>SEND OTP</Text>
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
  header: { paddingHorizontal: S.md, paddingVertical: S.sm, flexDirection: "row", alignItems: "center" },
  backBtn: { padding: S.sm, borderRadius: R.pill, backgroundColor: C.surfaceSecondary, width: 40, alignItems: "center" },
  title: { fontFamily: DISPLAY, fontSize: 28, color: C.onSurface, lineHeight: 34, letterSpacing: -0.5 },
  subtitle: { fontFamily: TEXT, fontSize: 14, color: C.onSurfaceSecondary, marginTop: S.md, lineHeight: 20 },
  field: {
    marginTop: S.xl,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surfaceSecondary,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  prefix: {
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  prefixText: { fontFamily: TEXT, fontSize: 16, color: C.onSurface, fontWeight: "600" },
  input: { flex: 1, fontFamily: TEXT, fontSize: 18, color: C.onSurface, paddingHorizontal: S.md, paddingVertical: S.md },
  error: { fontFamily: TEXT, fontSize: 12, color: C.error, marginTop: S.sm },
  cta: {
    backgroundColor: C.brand,
    paddingVertical: 16,
    borderRadius: R.pill,
    alignItems: "center",
  },
  ctaText: { fontFamily: TEXT, fontSize: 13, fontWeight: "700", color: C.onBrand, letterSpacing: 2 },
});
