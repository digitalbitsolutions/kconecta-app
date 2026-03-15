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
  completeManagerPriorityQueueItem,
  fetchManagerDashboardSummary,
  fetchManagerPendingActions,
  fetchManagerPriorityQueue,
  setManagerPortfolioLaunchContext,
  type ManagerPendingAction,
  type ManagerPriorityQueueItem,
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
  generatedAt: string;
  source: "database" | "in_memory";
};

type QueueActionState = {
  mode: "idle" | "pending" | "success" | "error";
  message?: string;
};

type PendingActionsState = {
  items: ManagerPendingAction[];
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
  generatedAt: "",
  source: "in_memory",
};

const emptyPendingActions: PendingActionsState = {
  items: [],
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

function severityLabel(priority: ManagerPriorityQueueItem): string {
  if (priority.severity === "high") {
    return "High";
  }
  if (priority.severity === "medium") {
    return "Medium";
  }
  return "Low";
}

function severityStyle(priority: ManagerPriorityQueueItem): object {
  if (priority.severity === "high") {
    return styles.priorityBadgeHigh;
  }
  if (priority.severity === "medium") {
    return styles.priorityBadgeMedium;
  }
  return styles.priorityBadgeLow;
}

function queueTitle(item: ManagerPriorityQueueItem): string {
  if (item.category === "provider_assignment") {
    return "Provider assignment pending";
  }
  if (item.category === "maintenance_follow_up") {
    return "Maintenance follow-up required";
  }
  if (item.category === "portfolio_review") {
    return "Reserved pipeline review";
  }
  return "Quality signal check";
}

function queueActionLabel(item: ManagerPriorityQueueItem, state: QueueActionState | undefined): string {
  if (item.completed) {
    return "Completed";
  }
  if (state?.mode === "pending") {
    return "Completing...";
  }
  if (state?.mode === "error") {
    return "Retry completion";
  }
  return "Complete queue action";
}

function pendingActionLabel(item: ManagerPendingAction): string {
  if (
    item.actionType === "handoff_pending_confirmation" ||
    item.actionType === "handoff_pending_acceptance"
  ) {
    return "Open handoff";
  }

  return "Open assignment detail";
}

function pendingActionPriorityStyle(priority: ManagerPendingAction["priorityBadge"]): object {
  if (priority === "high") {
    return styles.priorityBadgeHigh;
  }
  if (priority === "medium") {
    return styles.priorityBadgeMedium;
  }
  return styles.priorityBadgeLow;
}

const ManagerDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();
  const [summary, setSummary] = useState<DashboardSummaryState>(emptySummary);
  const [pendingActions, setPendingActions] = useState<PendingActionsState>(emptyPendingActions);
  const [priorityQueue, setPriorityQueue] = useState<ManagerPriorityQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [queueActionState, setQueueActionState] = useState<Record<string, QueueActionState>>({});

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
        const [summaryPayload, pendingActionsPayload, queuePayload] = await Promise.all([
          fetchManagerDashboardSummary(),
          fetchManagerPendingActions(6),
          fetchManagerPriorityQueue({ limit: 15 }),
        ]);
        setSummary({
          kpis: summaryPayload.kpis,
          generatedAt: summaryPayload.meta.generatedAt,
          source: summaryPayload.meta.source,
        });
        setPendingActions({
          items: pendingActionsPayload.items,
          generatedAt: pendingActionsPayload.meta.generatedAt,
          source: pendingActionsPayload.meta.source,
        });
        setPriorityQueue(queuePayload.items);
        setQueueActionState({});
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
          setPendingActions(emptyPendingActions);
          setPriorityQueue([]);
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

  const openAssignmentCenter = useCallback(() => {
    navigation.navigate("ManagerAssignmentCenter");
  }, [navigation]);

  const openPendingAction = useCallback(
    (item: ManagerPendingAction) => {
      if (
        item.deepLink.route === "manager_provider_handoff" &&
        item.deepLink.params.propertyId &&
        item.deepLink.params.queueItemId
      ) {
        navigation.navigate("ManagerToProviderHandoff", {
          propertyId: item.deepLink.params.propertyId,
          propertyTitle: item.subtitle.split(" · ")[0] ?? item.title,
          queueItemId: item.deepLink.params.queueItemId,
        });
        return;
      }

      if (item.deepLink.route === "manager_assignment_detail" && item.deepLink.params.queueItemId) {
        navigation.navigate("ManagerAssignmentDetail", {
          queueItemId: item.deepLink.params.queueItemId,
        });
        return;
      }

      setManagerPortfolioLaunchContext({
        search: item.subtitle.split(" · ")[0] ?? item.title,
      });
      navigation.navigate("PropertyList");
    },
    [navigation]
  );

  const onLogout = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const openQueueInPortfolio = useCallback(
    (item: ManagerPriorityQueueItem) => {
      setManagerPortfolioLaunchContext({
        status: item.status,
        search: item.propertyTitle,
        city: item.city,
      });
      navigation.navigate("PropertyList");
    },
    [navigation]
  );

  const onCompleteQueueItem = useCallback(
    async (item: ManagerPriorityQueueItem) => {
      if (item.completed) {
        return;
      }

      const nowIso = new Date().toISOString();
      const optimisticItem: ManagerPriorityQueueItem = {
        ...item,
        completed: true,
        completedAt: nowIso,
        resolutionCode: "resolved",
        updatedAt: nowIso,
        action: "open_property",
      };

      setQueueActionState((previous) => ({
        ...previous,
        [item.id]: { mode: "pending" },
      }));
      setPriorityQueue((previous) =>
        previous.map((queueItem) => (queueItem.id === item.id ? optimisticItem : queueItem))
      );

      try {
        const committedItem = await completeManagerPriorityQueueItem(item.id, {
          resolutionCode: "resolved",
        });
        setPriorityQueue((previous) =>
          previous.map((queueItem) => (queueItem.id === item.id ? committedItem : queueItem))
        );
        setQueueActionState((previous) => ({
          ...previous,
          [item.id]: { mode: "success", message: "Queue item completed." },
        }));
      } catch (actionError) {
        setPriorityQueue((previous) =>
          previous.map((queueItem) => (queueItem.id === item.id ? item : queueItem))
        );

        if (actionError instanceof ApiError) {
          if (actionError.status === 401) {
            navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
            return;
          }
          if (actionError.status === 403) {
            navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
            return;
          }
        }

        const message =
          actionError instanceof ApiError && actionError.status === 409
            ? `Conflict: ${actionError.message}`
            : actionError instanceof Error
              ? actionError.message
              : "Unable to complete queue action.";
        setQueueActionState((previous) => ({
          ...previous,
          [item.id]: { mode: "error", message },
        }));
      }
    },
    [navigation]
  );

  const showLoading = loading && !hasLoadedData;
  const showEmptyQueue = !showLoading && priorityQueue.length === 0;

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
        <Pressable style={styles.secondaryAction} onPress={openAssignmentCenter}>
          <Text style={styles.secondaryActionText}>Open Assignment Center</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("ProviderDirectory")}
        >
          <Text style={styles.secondaryActionText}>Open Provider Directory</Text>
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
          <Text style={styles.sectionTitle}>Pending actions</Text>
          <Text style={styles.sectionMeta}>
            Source: {pendingActions.source} | Updated: {formatIsoDate(pendingActions.generatedAt || null)}
          </Text>

          {pendingActions.items.length === 0 ? (
            <Text style={styles.emptyPriorityText}>
              No pending dashboard actions. Pull to refresh to confirm the latest handoff state.
            </Text>
          ) : null}

          {pendingActions.items.map((item) => (
            <View key={item.id} style={styles.priorityItem}>
              <View style={styles.priorityHeader}>
                <Text style={styles.priorityTitle}>{item.title}</Text>
                <View style={[styles.priorityBadgeBase, pendingActionPriorityStyle(item.priorityBadge)]}>
                  <Text style={styles.priorityBadgeText}>{item.priorityBadge}</Text>
                </View>
              </View>
              <Text style={styles.priorityDescription}>{item.subtitle}</Text>
              <Text style={styles.priorityMeta}>
                Status: {item.statusBadge} | Due: {formatIsoDate(item.dueAt)} | Updated: {formatIsoDate(item.updatedAt)}
              </Text>
              <Pressable style={styles.priorityActionButton} onPress={() => openPendingAction(item)}>
                <Text style={styles.priorityActionText}>{pendingActionLabel(item)}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Priority queue</Text>
          <Pressable style={styles.inlineLink} onPress={openAssignmentCenter}>
            <Text style={styles.inlineLinkText}>View assignment workspace</Text>
          </Pressable>

          {showEmptyQueue ? (
            <Text style={styles.emptyPriorityText}>No priority queue items. Pull to refresh to confirm latest state.</Text>
          ) : null}

          {priorityQueue.map((priority) => (
            <View
              key={priority.id}
              style={[styles.priorityItem, priority.completed && styles.priorityItemCompleted]}
            >
              <View style={styles.priorityHeader}>
                <Text style={styles.priorityTitle}>{queueTitle(priority)}</Text>
                <View style={[styles.priorityBadgeBase, severityStyle(priority)]}>
                  <Text style={styles.priorityBadgeText}>{severityLabel(priority)}</Text>
                </View>
              </View>
              <Text style={styles.priorityDescription}>
                {priority.propertyTitle} | {priority.city} | {priority.category}
              </Text>
              <Text style={styles.priorityMeta}>
                SLA: {priority.slaState} | Due: {formatIsoDate(priority.slaDueAt)} | Updated: {formatIsoDate(priority.updatedAt)}
              </Text>

              <Pressable
                style={styles.priorityActionButton}
                onPress={() =>
                  priority.category === "provider_assignment"
                    ? navigation.navigate("ManagerAssignmentDetail", { queueItemId: priority.id })
                    : openQueueInPortfolio(priority)
                }
              >
                <Text style={styles.priorityActionText}>
                  {priority.category === "provider_assignment"
                    ? "Open assignment detail"
                    : "Open in portfolio"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.priorityCompletionButton,
                  priority.completed && styles.priorityCompletionButtonDone,
                  queueActionState[priority.id]?.mode === "pending" && styles.actionDisabled,
                ]}
                disabled={priority.completed || queueActionState[priority.id]?.mode === "pending"}
                onPress={() => void onCompleteQueueItem(priority)}
              >
                <Text style={styles.priorityCompletionText}>
                  {queueActionLabel(priority, queueActionState[priority.id])}
                </Text>
              </Pressable>

              {priority.completedAt ? (
                <Text style={styles.priorityCompletionMeta}>
                  Completed: {formatIsoDate(priority.completedAt)}{priority.resolutionCode ? ` | ${priority.resolutionCode}` : ""}
                </Text>
              ) : null}

              {queueActionState[priority.id]?.message ? (
                <Text
                  style={
                    queueActionState[priority.id]?.mode === "error"
                      ? styles.priorityActionError
                      : styles.priorityActionSuccess
                  }
                >
                  {queueActionState[priority.id]?.message}
                </Text>
              ) : null}
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
  inlineLink: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  inlineLinkText: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  sectionMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginBottom: spacing.md,
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
  priorityItemCompleted: {
    backgroundColor: colors.background,
    borderColor: colors.accent,
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
  priorityActionButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  priorityActionText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priorityCompletionButton: {
    alignItems: "center",
    borderColor: colors.accent,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  priorityCompletionButtonDone: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  priorityCompletionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priorityCompletionMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
  },
  priorityActionSuccess: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  priorityActionError: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  actionDisabled: {
    opacity: 0.6,
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
