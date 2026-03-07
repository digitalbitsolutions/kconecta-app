import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { clearSession } from "../../auth/session";
import type { ManagerStackParamList } from "../../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../../theme/tokens";

type UnauthorizedNavigation = NativeStackNavigationProp<ManagerStackParamList, "Unauthorized">;

const UnauthorizedScreen = () => {
  const navigation = useNavigation<UnauthorizedNavigation>();

  const onReauthenticate = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const onSessionExpired = () => {
    navigation.navigate("SessionExpired");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Unauthorized Access</Text>
        <Text style={styles.body}>
          Your current session cannot access this operation. Re-authenticate to continue.
        </Text>

        <Pressable style={styles.primaryAction} onPress={onReauthenticate}>
          <Text style={styles.primaryActionText}>Go to Login</Text>
        </Pressable>

        <Pressable style={styles.secondaryAction} onPress={onSessionExpired}>
          <Text style={styles.secondaryActionText}>Mark as Session Expired</Text>
        </Pressable>
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
    fontSize: fontSizes.lg,
    fontWeight: "800",
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
});

export default UnauthorizedScreen;
