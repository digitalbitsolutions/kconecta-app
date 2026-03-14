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

  const onReturnToLogin = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Unauthorized Access</Text>
        <Text style={styles.body}>
          Your current session does not have the manager scope required for this operation.
          Return to login to clear the session and continue with a valid account.
        </Text>

        <Pressable style={styles.primaryAction} onPress={onReturnToLogin}>
          <Text style={styles.primaryActionText}>Return to Login</Text>
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
});

export default UnauthorizedScreen;
