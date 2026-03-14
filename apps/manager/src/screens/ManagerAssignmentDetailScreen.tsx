import React, { useCallback, useState } from "react";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError } from "../api/client";
import {
  completeManagerPriorityQueueItem,
  fetchManagerAssignmentDetail,
  type ManagerAssignmentDetail,
  type ManagerPriorityQueueResolutionCode,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type AssignmentDetailRoute = RouteProp<ManagerStackParamList, "ManagerAssignmentDetail">;
type AssignmentDetailNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "ManagerAssignmentDetail"
>;

function formatIsoDate(iso: string | null): string {
  if (!iso) {
    return "-";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString("es-ES");
}

const ManagerAssignmentDetailScreen = () => {
  const navigation = useNavigation<AssignmentDetailNavigation>();
  const route = useRoute<AssignmentDetailRoute>();
  const { queueItemId } = route.params;

  const [detail, setDetail] = useState<ManagerAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchManagerAssignmentDetail(queueItemId);
      setDetail(payload);
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
        requestError instanceof Error ? requestError.message : "Unable to load assignment detail.";
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [navigation, queueItemId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
      return undefined;
    }, [loadDetail])
  );

  const completeQueueItem = useCallback(async () => {
    if (!detail || detail.item.completed) {
      return;
    }

    setActionPending(true);
    setActionMessage(null);
    try {
      const resolutionCode: ManagerPriorityQueueResolutionCode =
        detail.assignment?.assigned ? "assigned" : "resolved";
      const committed = await completeManagerPriorityQueueItem(detail.item.id, {
        resolutionCode,
      });
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              item: committed,
            }
          : previous
      );
      setActionMessage("Queue item completed.");
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
        requestError instanceof Error ? requestError.message : "Unable to complete queue item.";
      setActionMessage(message);
    } finally {
      setActionPending(false);
    }
  }, [detail, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.feedbackCard}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.feedbackText}>Loading assignment detail...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.errorTitle}>Unable to load assignment detail</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.primaryAction} onPress={() => void loadDetail()}>
              <Text style={styles.primaryActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && detail ? (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{detail.property?.title ?? detail.item.propertyTitle}</Text>
              <Text style={styles.subtitle}>Manager assignment evidence and queue context.</Text>
              <Text style={styles.meta}>Queue item: {detail.item.id}</Text>
              <Text style={styles.meta}>
                {detail.item.city} | {detail.item.status} | {detail.item.category}
              </Text>
              <Text style={styles.meta}>
                SLA: {detail.item.slaState} | Due: {formatIsoDate(detail.item.slaDueAt)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Assignment state</Text>
              <Text style={styles.meta}>
                State: {detail.assignment?.state ?? "unassigned"}
              </Text>
              <Text style={styles.meta}>
                Assigned: {detail.assignment?.assigned ? "Yes" : "No"}
              </Text>
              <Text style={styles.meta}>
                Assigned at: {formatIsoDate(detail.assignment?.assignedAt ?? null)}
              </Text>
              <Text style={styles.meta}>Note: {detail.assignment?.note ?? "-"}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Provider snapshot</Text>
              <Text style={styles.meta}>
                {detail.provider
                  ? `${detail.provider.name} | ${detail.provider.category} | ${detail.provider.city}`
                  : "No provider currently linked"}
              </Text>
              <Text style={styles.meta}>
                {detail.provider
                  ? `Status: ${detail.provider.status} | Rating: ${detail.provider.rating}`
                  : "Use provider handoff if assignment is still pending."}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              {detail.timeline.length === 0 ? (
                <Text style={styles.meta}>No timeline evidence available.</Text>
              ) : (
                detail.timeline.map((event) => (
                  <View key={event.id} style={styles.timelineItem}>
                    <Text style={styles.timelineTitle}>{event.summary}</Text>
                    <Text style={styles.timelineMeta}>
                      {event.actor} | {formatIsoDate(event.occurredAt)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {detail.property ? (
              <Pressable
                style={styles.primaryAction}
                onPress={() =>
                  navigation.navigate("PropertyDetail", {
                    propertyId: detail.property!.id,
                    propertyTitle: detail.property!.title,
                  })
                }
              >
                <Text style={styles.primaryActionText}>Open property detail</Text>
              </Pressable>
            ) : null}

            {detail.property && detail.item.action === "open_handoff" ? (
              <Pressable
                style={styles.secondaryAction}
                onPress={() =>
                  navigation.navigate("ManagerToProviderHandoff", {
                    propertyId: detail.property!.id,
                    propertyTitle: detail.property!.title,
                    preselectedProviderId: detail.provider?.id,
                  })
                }
              >
                <Text style={styles.secondaryActionText}>Open provider handoff</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[
                styles.secondaryAction,
                (detail.item.completed || actionPending) && styles.actionDisabled,
              ]}
              disabled={detail.item.completed || actionPending}
              onPress={() => void completeQueueItem()}
            >
              <Text style={styles.secondaryActionText}>
                {detail.item.completed ? "Queue item completed" : actionPending ? "Completing..." : "Complete queue item"}
              </Text>
            </Pressable>

            {actionMessage ? (
              <Text style={styles.actionMessage}>{actionMessage}</Text>
            ) : null}
          </>
        ) : null}
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
  feedbackCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.lg,
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
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
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  timelineItem: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  timelineTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  timelineMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
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
    fontWeight: "700",
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionMessage: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
  },
});

export default ManagerAssignmentDetailScreen;
