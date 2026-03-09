import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import {
  clearSession,
  getSessionIdentitySnapshot,
  getSessionSnapshot,
  handleUnauthorizedSession,
} from "../auth/session";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type DashboardNavigation = NativeStackNavigationProp<RootStackParamList, "ProviderDashboard">;

const ProviderDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const session = getSessionSnapshot();
  const identity = getSessionIdentitySnapshot();
  const roleLabel = identity.role ?? "unknown";

  const openMyProfile = () => {
    if (!identity.providerId) {
      handleUnauthorizedSession();
      navigation.navigate("ProviderUnauthorized");
      return;
    }

    navigation.navigate("ProviderDetail", {
      providerId: identity.providerId,
      providerName: `Provider ${identity.providerId}`,
    });
  };

  const onSignOut = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "ProviderLogin" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Provider Dashboard</Text>
      <Text style={styles.subtitle}>Manage your profile, availability and daily operations.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.cardValue}>{identity.providerId ? `Provider #${identity.providerId}` : "No provider identity"}</Text>
        <Text style={styles.cardHelper}>Role: {roleLabel}</Text>
        <Text style={styles.cardHelper}>Token source: {session.hasToken ? session.source : "none"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Availability</Text>
        <Text style={styles.cardValue}>Manage weekly slots</Text>
        <Text style={styles.cardHelper}>Keep your schedule updated for assignments</Text>
        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("AvailabilityShell")}>
          <Text style={styles.primaryActionText}>Open Availability Editor</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>My profile</Text>
        <Text style={styles.cardHelper}>Review your provider profile and operational status.</Text>
        <Pressable style={styles.secondaryAction} onPress={openMyProfile}>
          <Text style={styles.secondaryActionText}>Open My Profile</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.warningAction}
        onPress={() => {
          handleUnauthorizedSession();
          navigation.navigate("ProviderUnauthorized");
        }}
      >
        <Text style={styles.warningActionText}>Simulate Unauthorized State</Text>
      </Pressable>

      <Pressable style={styles.signOutAction} onPress={onSignOut}>
        <Text style={styles.signOutActionText}>Sign out</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
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
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  cardValue: {
    color: colors.brand,
    fontSize: fontSizes.lg,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  cardHelper: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
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
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
  warningAction: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  warningActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  signOutAction: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  signOutActionText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});

export default ProviderDashboardScreen;
