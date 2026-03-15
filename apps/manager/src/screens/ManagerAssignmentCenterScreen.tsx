import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import {
  fetchManagerAssignmentCenter,
  setManagerPortfolioLaunchContext,
  type ManagerPriorityQueueItem,
  type PropertyStatus,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type AssignmentCenterNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "ManagerAssignmentCenter"
>;
type StatusFilter = "all" | PropertyStatus;

const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Reserved", value: "reserved" },
  { label: "Maintenance", value: "maintenance" },
];

function formatIsoDate(iso: string | null): string {
  if (!iso) {
    return "No deadline";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString("es-ES");
}

function formatRecommendedAction(action: string | null): string {
  switch (action) {
    case "complete":
      return "Complete assignment";
    case "reassign":
      return "Reassign provider";
    case "cancel":
      return "Cancel assignment";
    default:
      return "Review assignment detail";
  }
}

function resolveRollupBadgeStyle(
  state: NonNullable<ManagerPriorityQueueItem["decisionRollup"]>["currentState"]
) {
  switch (state) {
    case "completed":
      return styles.rollupBadgeCompleted;
    case "cancelled":
      return styles.rollupBadgeCancelled;
    case "provider_missing":
      return styles.rollupBadgeWarning;
    case "assigned":
      return styles.rollupBadgeAssigned;
    default:
      return styles.rollupBadgeDefault;
  }
}

const ManagerAssignmentCenterScreen = () => {
  const navigation = useNavigation<AssignmentCenterNavigation>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [items, setItems] = useState<ManagerPriorityQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedSearch = useMemo(() => search.trim(), [search]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchManagerAssignmentCenter({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: normalizedSearch || undefined,
        limit: 20,
      });
      setItems(payload.items);
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

      const message =
        requestError instanceof Error ? requestError.message : "Unable to load assignment center.";
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [navigation, normalizedSearch, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
      return undefined;
    }, [loadQueue])
  );

  const openInPortfolio = useCallback(
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Assignment Center</Text>
        <Text style={styles.subtitle}>
          Review provider-assignment queue items, filter by status and inspect the current evidence.
        </Text>

        <View style={styles.filterCard}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by property or city"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.filterChip,
                  statusFilter === option.value ? styles.filterChipActive : styles.filterChipIdle,
                ]}
                onPress={() => setStatusFilter(option.value)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === option.value && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primaryAction} onPress={() => void loadQueue()}>
            <Text style={styles.primaryActionText}>Apply filters</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.feedbackText}>Loading assignment queue...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.errorTitle}>Unable to load assignment center</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryAction} onPress={() => void loadQueue()}>
              <Text style={styles.retryActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>No assignment items</Text>
            <Text style={styles.feedbackText}>
              There are no provider-assignment queue items for the current filters.
            </Text>
          </View>
        ) : null}

        {!loading &&
          !error &&
          items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.propertyTitle}</Text>
                <View
                  style={[
                    styles.severityBadge,
                    item.severity === "high"
                      ? styles.badgeHigh
                      : item.severity === "medium"
                        ? styles.badgeMedium
                        : styles.badgeLow,
                  ]}
                >
                  <Text style={styles.severityBadgeText}>{item.severity}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>
                {item.city} | {item.status} | SLA {item.slaState}
              </Text>
              <Text style={styles.itemMeta}>Due: {formatIsoDate(item.slaDueAt)}</Text>
              <Text style={styles.itemMeta}>Updated: {formatIsoDate(item.updatedAt)}</Text>

              {item.decisionRollup ? (
                <View style={styles.rollupCard}>
                  <View style={styles.rollupHeader}>
                    <Text style={styles.rollupTitle}>{item.decisionRollup.latestDecisionLabel}</Text>
                    <View
                      style={[
                        styles.rollupBadge,
                        resolveRollupBadgeStyle(item.decisionRollup.currentState),
                      ]}
                    >
                      <Text style={styles.rollupBadgeText}>{item.decisionRollup.statusBadge}</Text>
                    </View>
                  </View>
                  <Text style={styles.rollupMeta}>
                    Last decision: {formatIsoDate(item.decisionRollup.latestDecisionAt)}
                  </Text>
                  <Text style={styles.rollupMeta}>
                    Evidence: {item.decisionRollup.evidenceCount}{" "}
                    {item.decisionRollup.hasEvidence ? "| Evidence attached" : "| No evidence yet"}
                  </Text>
                  <Text style={styles.rollupMeta}>
                    Suggested next step:{" "}
                    {formatRecommendedAction(item.decisionRollup.nextRecommendedAction)}
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={styles.primaryAction}
                onPress={() => navigation.navigate("ManagerAssignmentDetail", { queueItemId: item.id })}
              >
                <Text style={styles.primaryActionText}>Open assignment detail</Text>
              </Pressable>
              <Pressable style={styles.secondaryAction} onPress={() => openInPortfolio(item)}>
                <Text style={styles.secondaryActionText}>Open in portfolio</Text>
              </Pressable>
            </View>
          ))}
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
  filterCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  filterChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipIdle: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
    borderWidth: 1,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: colors.brand,
  },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  feedbackText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  retryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  itemCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  itemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginRight: spacing.sm,
  },
  itemMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  rollupCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  rollupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rollupTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    marginRight: spacing.sm,
  },
  rollupMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  severityBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeHigh: {
    backgroundColor: colors.danger,
  },
  badgeMedium: {
    backgroundColor: colors.warning,
  },
  badgeLow: {
    backgroundColor: colors.border,
  },
  severityBadgeText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rollupBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rollupBadgeDefault: {
    backgroundColor: colors.brandSoft,
  },
  rollupBadgeAssigned: {
    backgroundColor: colors.brandSoft,
  },
  rollupBadgeCompleted: {
    backgroundColor: "#DCFCE7",
  },
  rollupBadgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  rollupBadgeCancelled: {
    backgroundColor: "#FEE2E2",
  },
  rollupBadgeText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "700",
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
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});

export default ManagerAssignmentCenterScreen;
