import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { getSessionSnapshot, handleUnauthorizedSession } from "../auth/session";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type DashboardNavigation = NativeStackNavigationProp<RootStackParamList, "ProviderDashboard">;

const ProviderDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const session = getSessionSnapshot();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Provider Dashboard</Text>
      <Text style={styles.subtitle}>Track availability, status and assigned workload.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today Status</Text>
        <Text style={styles.cardValue}>Active</Text>
        <Text style={styles.cardHelper}>Session: {session.hasToken ? session.source : "none"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Availability</Text>
        <Text style={styles.cardValue}>3 Open Slots</Text>
        <Text style={styles.cardHelper}>Morning 2 | Afternoon 1</Text>
        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("AvailabilityShell")}>
          <Text style={styles.primaryActionText}>Manage Availability</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Directory</Text>
        <Text style={styles.cardHelper}>Browse providers and detail records.</Text>
        <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate("ProviderList")}>
          <Text style={styles.secondaryActionText}>Open Providers</Text>
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
});

export default ProviderDashboardScreen;
