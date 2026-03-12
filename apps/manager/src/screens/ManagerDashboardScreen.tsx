import React, { useCallback, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import {
  fetchManagerDashboardSummary,
  type ManagerDashboardPriorityItem,
  type PortfolioKpis,
} from "../api/propertyApi";
import { clearSession, getSessionSnapshot } from "../auth/session";
import KpiCard from "../components/KpiCard";
import { managerEnv } from "../config/env";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type DashboardNavigation = NativeStackNavigationProp<ManagerStackParamList, "ManagerDashboard">;

type DashboardSummaryState = {
  kpis: PortfolioKpis;
  priorities: ManagerDashboardPriorityItem[];
  generatedAt: string;
  source: "database" | "in_memory";
};

const emptyKpis: PortfolioKpis = {
  activeProperties: 0,
  reservedProperties: 0,
  avgTimeToCloseDays: 0,
  providerMatchesPending: 0,
};

const emptySummary: DashboardSummaryState = {
  kpis: emptyKpis,
  priorities: [],
  generatedAt: "",
  source: "in_memory",
};

function formatIsoDate(iso: string | null): string {
  if (!iso) {
    return "No due date";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function severityLabel(priority: ManagerDashboardPriorityItem): string {
  if (priority.severity === "high") {
    return "High";
  }
  if (priority.severity === "medium") {
    return "Medium";
  }
  return "Low";
}

function severityStyle(priority: ManagerDashboardPriorityItem): object {
  if (priority.severity === "high") {
    return styles.priorityBadgeHigh;
  }
  if (priority.severity === "medium") {
    return styles.priorityBadgeMedium;
  }
  return styles.priorityBadgeLow;
}

const ManagerDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const [summary, setSummary] = useState<DashboardSummaryState>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const sessionSnapshot = getSessionSnapshot();
  const roleLabel = sessionSnapshot.role ?? "unknown";

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const payload = await fetchManagerDashboardSummary();
        setSummary({
          kpis: payload.kpis,
          priorities: payload.priorities,
          generatedAt: payload.meta.generatedAt,
          source: payload.meta.source,
        });
        setHasLoadedData(true);
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
        if (!hasLoadedData) {
          setSummary(emptySummary);
        }
      } finally {
        if (mode === "refresh") {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [hasLoadedData, navigation]
  );

  useFocusEffect(
    useCallback(() => {
      loadDashboard("initial");
      return undefined;
    }, [loadDashboard])
  );

  const onRefresh = useCallback(() => {
    void loadDashboard("refresh");
  }, [loadDashboard]);

  const onLogout = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const showLoading = loading && !hasLoadedData;
  const showEmptyPriorities = !showLoading && summary.priorities.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Manager Dashboard</Text>
        <Text style={styles.subtitle}>Track portfolio health and property operations.</Text>

        {showLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Loading dashboard summary...</Text>
          </View>
        ) : null}

        {error && !hasLoadedData ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load dashboard</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadDashboard("initial")}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {error && hasLoadedData ? (
          <View style={styles.degradedCard}>
            <Text style={styles.degradedTitle}>Showing last available dashboard snapshot</Text>
            <Text style={styles.degradedBody}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.kpiGrid}>
          <KpiCard label="Active Properties" value={String(summary.kpis.activeProperties)} helper="Current portfolio" />
          <KpiCard label="Reserved" value={String(summary.kpis.reservedProperties)} helper="Current pipeline" />
          <KpiCard
            label="Avg. Time to Close"
            value={`${summary.kpis.avgTimeToCloseDays}d`}
            helper="Contract metric"
          />
          <KpiCard
            label="Provider Matches"
            value={String(summary.kpis.providerMatchesPending)}
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
            <Text style={styles.diagnosticsItem}>Summary source: {summary.source}</Text>
            <Text style={styles.diagnosticsItem}>Generated at: {formatIsoDate(summary.generatedAt || null)}</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today priorities</Text>

          {showEmptyPriorities ? (
            <Text style={styles.emptyPriorityText}>No priorities pending. Pull to refresh to confirm latest state.</Text>
          ) : null}

          {summary.priorities.map((priority) => (
            <View key={priority.id} style={styles.priorityItem}>
              <View style={styles.priorityHeader}>
                <Text style={styles.priorityTitle}>{priority.title}</Text>
                <View style={[styles.priorityBadgeBase, severityStyle(priority)]}>
                  <Text style={styles.priorityBadgeText}>{severityLabel(priority)}</Text>
                </View>
              </View>
              <Text style={styles.priorityDescription}>{priority.description}</Text>
              <Text style={styles.priorityMeta}>
                Due: {formatIsoDate(priority.dueAt)} | Updated: {formatIsoDate(priority.updatedAt)}
              </Text>
            </View>
          ))}
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
  degradedCard: {
    backgroundColor: colors.surface,
    borderColor: colors.warning,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  degradedTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  degradedBody: {
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
  emptyPriorityText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  priorityItem: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  priorityHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priorityTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    marginRight: spacing.sm,
  },
  priorityDescription: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  priorityMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
  },
  priorityBadgeBase: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  priorityBadgeHigh: {
    backgroundColor: colors.danger,
  },
  priorityBadgeMedium: {
    backgroundColor: colors.warning,
  },
  priorityBadgeLow: {
    backgroundColor: colors.border,
  },
  priorityBadgeText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
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
