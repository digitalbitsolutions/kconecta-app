import React, { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import { fetchPropertyPortfolio, type PortfolioKpis } from "../api/propertyApi";
import { clearSession, getSessionSnapshot } from "../auth/session";
import KpiCard from "../components/KpiCard";
import { managerEnv } from "../config/env";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type DashboardNavigation = NativeStackNavigationProp<ManagerStackParamList, "ManagerDashboard">;

const emptyKpis: PortfolioKpis = {
  activeProperties: 0,
  reservedProperties: 0,
  avgTimeToCloseDays: 0,
  providerMatchesPending: 0,
};

const ManagerDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const [kpis, setKpis] = useState<PortfolioKpis>(emptyKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionSnapshot = getSessionSnapshot();
  const roleLabel = sessionSnapshot.role ?? "unknown";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchPropertyPortfolio({ page: 1, perPage: 25 });
      setKpis(payload.kpis);
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        if (requestError.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
          return;
        }
        if (requestError.status === 403) {
          navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
          return;
        }
      }

      const message = requestError instanceof Error ? requestError.message : "Unable to load manager dashboard.";
      setError(message);
      setKpis(emptyKpis);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      return undefined;
    }, [loadDashboard])
  );

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

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load dashboard</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadDashboard}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.kpiGrid}>
          <KpiCard label="Active Properties" value={String(kpis.activeProperties)} helper="Current portfolio" />
          <KpiCard label="Reserved" value={String(kpis.reservedProperties)} helper="Current pipeline" />
          <KpiCard label="Avg. Time to Close" value={`${kpis.avgTimeToCloseDays}d`} helper="Contract metric" />
          <KpiCard
            label="Provider Matches"
            value={String(kpis.providerMatchesPending)}
            helper="Pending operations"
          />
        </View>

        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("PropertyList")}>
          <Text style={styles.primaryActionText}>Open Property Portfolio</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() =>
            navigation.navigate("ManagerToProviderHandoff", {
              propertyId: "101",
              propertyTitle: "Modern Loft Center",
              preselectedProviderId: "1",
            })
          }
        >
          <Text style={styles.secondaryActionText}>Open Provider Handoff</Text>
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
          <Text style={styles.sectionItem}>- Review newly listed properties</Text>
          <Text style={styles.sectionItem}>- Confirm provider assignment queue</Text>
          <Text style={styles.sectionItem}>- Resolve maintenance alerts</Text>
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
  loadingWrap: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
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

