import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type AvailabilityNavigation = NativeStackNavigationProp<RootStackParamList, "AvailabilityShell">;

const AvailabilityShellScreen = () => {
  const navigation = useNavigation<AvailabilityNavigation>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Availability Management</Text>
        <Text style={styles.body}>
          This shell is ready for weekly slot editing and service coverage controls in next iteration.
        </Text>

        <View style={styles.slotRow}>
          <Text style={styles.slotLabel}>Mon-Fri</Text>
          <Text style={styles.slotValue}>08:00 - 12:00</Text>
        </View>
        <View style={styles.slotRow}>
          <Text style={styles.slotLabel}>Sat</Text>
          <Text style={styles.slotValue}>09:00 - 13:00</Text>
        </View>

        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("ProviderDashboard")}>
          <Text style={styles.primaryActionText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
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
  slotRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  slotLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  slotValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});

export default AvailabilityShellScreen;
