import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { clearSession, getSessionSnapshot } from "../auth/session";
import KpiCard from "../components/KpiCard";
import { managerEnv } from "../config/env";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type DashboardNavigation = NativeStackNavigationProp<ManagerStackParamList, "ManagerDashboard">;

const ManagerDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const sessionSnapshot = getSessionSnapshot();
  const roleLabel = sessionSnapshot.role ?? "unknown";

  const onLogout = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Manager Dashboard</Text>
        <Text style={styles.subtitle}>Track portfolio health and property operations.</Text>

        <View style={styles.kpiGrid}>
          <KpiCard label="Active Properties" value="84" helper="+6 this month" />
          <KpiCard label="Reserved" value="12" helper="14.2% conversion" />
          <KpiCard label="Avg. Time to Close" value="21d" helper="-3d vs last month" />
          <KpiCard label="Provider Matches" value="37" helper="8 pending actions" />
        </View>

        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("PropertyList")}>
          <Text style={styles.primaryActionText}>Open Property Portfolio</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() =>
            navigation.navigate("ManagerToProviderHandoff", {
              providerId: "1",
              propertyId: "101",
            })
          }
        >
          <Text style={styles.secondaryActionText}>Open Provider Handoff State</Text>
        </Pressable>

        {managerEnv.diagnosticsEnabled ? (
          <View style={styles.diagnosticsCard}>
            <Text style={styles.diagnosticsTitle}>Environment diagnostics</Text>
            <Text style={styles.diagnosticsItem}>Stage: {managerEnv.stage}</Text>
            <Text style={styles.diagnosticsItem}>API: {managerEnv.apiBaseUrl}</Text>
            <Text style={styles.diagnosticsItem}>Role: {roleLabel}</Text>
            <Text style={styles.diagnosticsItem}>
              Token: {sessionSnapshot.hasToken ? `loaded (${sessionSnapshot.source})` : "missing"}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today priorities</Text>
          <Text style={styles.sectionItem}>- Review 4 newly listed properties</Text>
          <Text style={styles.sectionItem}>- Confirm provider assignment for 3 requests</Text>
          <Text style={styles.sectionItem}>- Resolve 2 maintenance alerts</Text>
        </View>

        <Pressable style={styles.logoutAction} onPress={onLogout}>
          <Text style={styles.logoutActionText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
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
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
  diagnosticsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  diagnosticsTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  diagnosticsItem: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  sectionItem: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  logoutAction: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  logoutActionText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});

export default ManagerDashboardScreen;
