import React, { useCallback, useEffect, useState } from "react";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
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
  assignProviderToProperty,
  fetchPropertyById,
  fetchProviderCandidates,
  type PropertyTimelineEvent,
  type ProviderCandidate,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type HandoffRoute = RouteProp<ManagerStackParamList, "ManagerToProviderHandoff">;
type HandoffNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "ManagerToProviderHandoff"
>;

const ManagerToProviderHandoffScreen = () => {
  const route = useRoute<HandoffRoute>();
  const navigation = useNavigation<HandoffNavigation>();
  const { propertyId, propertyTitle, preselectedProviderId } = route.params;
  const [candidates, setCandidates] = useState<ProviderCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [latestTimelineEvent, setLatestTimelineEvent] = useState<PropertyTimelineEvent | null>(null);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = await fetchProviderCandidates(propertyId);
      setCandidates(payload);
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
        requestError instanceof Error ? requestError.message : "Unable to load provider candidates.";
      setError(message);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [navigation, propertyId]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const assignCandidate = useCallback(
    async (providerId: string) => {
      setAssigningId(providerId);
      setError(null);
      setSuccess(null);
      setLatestTimelineEvent(null);

      try {
        const payload = await assignProviderToProperty(propertyId, providerId, note);
        const detail = await fetchPropertyById(propertyId);
        const assignmentEvent =
          detail.timeline.find((event) => event.type === "assignment") ?? detail.timeline[0] ?? null;
        setLatestTimelineEvent(assignmentEvent);
        setSuccess(`Provider #${payload.providerId} assigned successfully.`);
        navigation.navigate("PropertyDetail", {
          propertyId,
          propertyTitle: propertyTitle ?? `Property #${propertyId}`,
        });
        return;
      } catch (mutationError) {
        if (mutationError instanceof ApiError) {
          if (mutationError.status === 401) {
            navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
            return;
          }
          if (mutationError.status === 403) {
            navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
            return;
          }
        }

        const message =
          mutationError instanceof Error ? mutationError.message : "Unable to assign provider.";
        setError(message);
      } finally {
        setAssigningId(null);
      }
    },
    [navigation, note, propertyId]
  );

  const formatTimelineSubtitle = useCallback((occurredAt: string, actor: string): string => {
    const timestamp = new Date(occurredAt);
    const formattedTimestamp = Number.isNaN(timestamp.getTime())
      ? occurredAt
      : timestamp.toLocaleString("es-ES");
    return `${actor} · ${formattedTimestamp}`;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
        <Text style={styles.title}>Manager to Provider Handoff</Text>
          <Text style={styles.body}>
            Choose an active provider for this property. This flow is now connected to assignment APIs.
          </Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Property</Text>
            <Text style={styles.metaValue}>
              {propertyTitle?.trim().length ? `${propertyTitle} (#${propertyId})` : `#${propertyId}`}
            </Text>
        </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Optional assignment note"
            placeholderTextColor={colors.textMuted}
            style={styles.noteInput}
          />

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.loadingText}>Loading provider candidates...</Text>
            </View>
          ) : null}

          {!loading && error ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorTitle}>Assignment failed</Text>
              <Text style={styles.errorBody}>{error}</Text>
              <Pressable style={styles.retryAction} onPress={loadCandidates}>
                <Text style={styles.retryActionText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error && candidates.length === 0 ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Candidates</Text>
              <Text style={styles.metaValue}>No active providers available for assignment.</Text>
            </View>
          ) : null}

          {!loading && !error && candidates.length > 0 ? (
            <View style={styles.candidateList}>
              {candidates.map((candidate) => {
                const isPreferred = preselectedProviderId === candidate.id;
                const isAssigning = assigningId === candidate.id;
                return (
                  <View key={candidate.id} style={styles.candidateCard}>
                    <Text style={styles.candidateTitle}>
                      {candidate.name} {isPreferred ? "(suggested)" : ""}
                    </Text>
                    <Text style={styles.candidateBody}>
                      #{candidate.id} | {candidate.category} | {candidate.city} | rating {candidate.rating}
                    </Text>
                    <Pressable
                      style={[styles.primaryAction, isAssigning && styles.actionDisabled]}
                      disabled={assigningId !== null}
                      onPress={() => assignCandidate(candidate.id)}
                    >
                      <Text style={styles.primaryActionText}>
                        {isAssigning ? "Assigning..." : `Assign Provider #${candidate.id}`}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          {success ? <Text style={styles.successText}>{success}</Text> : null}

          {latestTimelineEvent ? (
            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>Latest assignment event</Text>
              <Text style={styles.timelineSummary}>{latestTimelineEvent.summary}</Text>
              <Text style={styles.timelineMeta}>
                {formatTimelineSubtitle(latestTimelineEvent.occurredAt, latestTimelineEvent.actor)}
              </Text>
            </View>
          ) : null}

        <Pressable
          style={styles.secondaryAction}
            onPress={() =>
              navigation.navigate("PropertyDetail", {
                propertyId,
                propertyTitle: propertyTitle ?? `Property #${propertyId}`,
              })
            }
        >
            <Text style={styles.secondaryActionText}>Back to Property Detail</Text>
        </Pressable>
        </View>
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
  noteInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metaBlock: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    textTransform: "uppercase",
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
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
  errorBlock: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  retryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  retryActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  candidateList: {
    marginTop: spacing.md,
  },
  candidateCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  candidateTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  candidateBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
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
  actionDisabled: {
    opacity: 0.6,
  },
  successText: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
  },
  timelineCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  timelineTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  timelineSummary: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  timelineMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
});

export default ManagerToProviderHandoffScreen;
