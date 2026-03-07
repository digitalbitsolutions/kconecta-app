import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { setRuntimeToken } from "../../auth/session";
import { managerEnv } from "../../config/env";
import type { ManagerStackParamList } from "../../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../../theme/tokens";

type LoginNavigation = NativeStackNavigationProp<ManagerStackParamList, "Login">;

const LoginScreen = () => {
  const navigation = useNavigation<LoginNavigation>();
  const [token, setToken] = useState(managerEnv.mobileApiToken);

  const onContinue = () => {
    setRuntimeToken(token);
    navigation.reset({
      index: 0,
      routes: [{ name: "ManagerDashboard" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Manager Access</Text>
        <Text style={styles.subtitle}>Authenticate to continue into property operations.</Text>

        <Text style={styles.label}>Bearer token</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          placeholder="Enter manager token"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={styles.primaryAction} onPress={onContinue}>
          <Text style={styles.primaryActionText}>Continue</Text>
        </Pressable>

        <Text style={styles.meta}>
          Stage: {managerEnv.stage} | API: {managerEnv.apiBaseUrl}
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
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.md,
  },
});

export default LoginScreen;
