import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, requestJson } from "../../api/client";
import { setRuntimeSession } from "../../auth/session";
import { providerEnv } from "../../config/env";
import type { RootStackParamList } from "../../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../../theme/tokens";

type LoginNavigation = NativeStackNavigationProp<RootStackParamList, "ProviderLogin">;

type LoginApiPayload = {
  data?: {
    access_token?: string;
    refresh_token?: string;
    role?: string | null;
    provider_id?: number | string | null;
  };
  error?: {
    message?: string;
  };
  message?: string;
};

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProviderId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return toStringOrNull(value);
}

const ProviderLoginScreen = () => {
  const navigation = useNavigation<LoginNavigation>();

  const [email, setEmail] = useState(providerEnv.bootstrapEmail);
  const [password, setPassword] = useState(providerEnv.bootstrapPassword);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = await requestJson<LoginApiPayload>("/auth/login", {
        method: "POST",
        body: {
          email: normalizedEmail,
          password: normalizedPassword,
        },
      });

      const data = payload?.data ?? {};
      const accessToken = toStringOrNull(data.access_token);
      const role = toStringOrNull(data.role) ?? providerEnv.bootstrapRole;
      const providerId = normalizeProviderId(data.provider_id) ?? providerEnv.bootstrapProviderId;

      if (!accessToken) {
        const apiError = toStringOrNull(payload?.error?.message);
        const fallbackMessage = toStringOrNull(payload?.message);
        setError(apiError ?? fallbackMessage ?? "Unable to sign in.");
        return;
      }

      if (role !== "provider" && role !== "admin") {
        setError("This account cannot access the provider app.");
        return;
      }

      if (role === "provider" && !providerId) {
        setError("Provider identity is missing in this session.");
        return;
      }

      setRuntimeSession({
        accessToken,
        refreshToken: toStringOrNull(data.refresh_token),
        role,
        providerId,
        source: "runtime",
      });

      navigation.reset({
        index: 0,
        routes: [{ name: "ProviderDashboard" }],
      });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        if (requestError.status === 404) {
          setError("This CRM backend does not expose /api/auth/login for mobile yet.");
          return;
        }
        setError(requestError.message);
        return;
      }
      const message = requestError instanceof Error ? requestError.message : "Network request failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Image source={require("../../../assets/images/logo-clean.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Provider Access</Text>
        <Text style={styles.subtitle}>Sign in to continue into provider workflows.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
          placeholder="provider1@provider.local"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.primaryAction, isSubmitting ? styles.primaryActionDisabled : null]}
          onPress={onContinue}
          disabled={isSubmitting}
        >
          <Text style={styles.primaryActionText}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Text>
        </Pressable>

        <Text style={styles.meta}>
          Stage: {providerEnv.stage} | API: {providerEnv.apiBaseUrl}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  logo: {
    alignSelf: "center",
    height: 64,
    marginBottom: spacing.md,
    width: 64,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryActionDisabled: {
    opacity: 0.65,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.md,
  },
});

export default ProviderLoginScreen;
