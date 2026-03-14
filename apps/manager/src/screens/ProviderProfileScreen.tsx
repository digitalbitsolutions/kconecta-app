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
  View,
} from "react-native";
import { ApiError } from "../api/client";
import { setManagerAssignmentSelectionResult } from "../api/propertyApi";
import { fetchManagerProviderProfile, type ProviderProfile } from "../api/providerApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type ProviderProfileRoute = RouteProp<ManagerStackParamList, "ProviderProfile">;
type ProviderProfileNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "ProviderProfile"
>;

const ProviderProfileScreen = () => {
  const navigation = useNavigation<ProviderProfileNavigation>();
  const route = useRoute<ProviderProfileRoute>();
  const { providerId, providerName, selectionContext } = route.params;
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchManagerProviderProfile(providerId, {
        queueItemId: selectionContext?.queueItemId,
      });
      setProfile(payload);
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
        requestError instanceof Error ? requestError.message : "Unable to load provider profile.";
      setError(message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [navigation, providerId, selectionContext?.queueItemId]);

  const handleSelectProvider = useCallback(() => {
    if (!selectionContext || !profile) {
      return;
    }

    setManagerAssignmentSelectionResult({
      queueItemId: selectionContext.queueItemId,
      providerId: profile.id,
      providerName: profile.name,
    });
    navigation.pop(2);
  }, [navigation, profile, selectionContext]);

  const isCurrentProvider = selectionContext?.currentProviderId === profile?.id;
  const scorecardToneStyle = profile?.assignmentFit
    ? profile.assignmentFit.recommended
      ? styles.scorecardRecommended
      : profile.assignmentFit.nextAction === null
        ? styles.scorecardUnavailable
        : styles.scorecardWarning
    : null;

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{profile?.name ?? providerName ?? "Provider profile"}</Text>
        <Text style={styles.subtitle}>
          Review provider identity, service coverage and responsiveness before assignment.
        </Text>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Loading provider profile...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>Unable to load provider profile</Text>
            <Text style={styles.feedbackBody}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadProfile()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && profile ? (
          <>
            {selectionContext ? (
              <View style={styles.selectionContextCard}>
                <Text style={styles.selectionContextTitle}>Assignment context</Text>
                <Text style={styles.sectionLine}>{selectionContext.propertyTitle}</Text>
                <Text style={styles.sectionLine}>Queue item: {selectionContext.queueItemId}</Text>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.headerRow}>
                <View style={styles.headerCopy}>
                  <Text style={styles.providerName}>{profile.name}</Text>
                  <Text style={styles.providerMeta}>
                    {profile.category} | {profile.city} | {profile.status}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingBadgeText}>{profile.rating}</Text>
                </View>
              </View>
              <Text style={styles.sectionBody}>{profile.bio ?? "No provider bio available."}</Text>
            </View>

            {profile.assignmentFit ? (
              <View style={[styles.sectionCard, styles.scorecardCard, scorecardToneStyle]}>
                <Text style={styles.sectionTitle}>Assignment fit</Text>
                <Text style={styles.scorecardLabel}>{profile.assignmentFit.scoreLabel}</Text>
                {profile.assignmentFit.matchReasons.length > 0 ? (
                  <View style={styles.scorecardList}>
                    {profile.assignmentFit.matchReasons.map((reason) => (
                      <Text key={reason} style={styles.scorecardReason}>
                        + {reason}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {profile.assignmentFit.warnings.length > 0 ? (
                  <View style={styles.scorecardList}>
                    {profile.assignmentFit.warnings.map((warning) => (
                      <Text key={warning} style={styles.scorecardWarningText}>
                        ! {warning}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {selectionContext ? (
                  isCurrentProvider ? (
                    <View style={styles.selectionNotice}>
                      <Text style={styles.selectionNoticeText}>This provider is already assigned.</Text>
                    </View>
                  ) : profile.assignmentFit.nextAction === "select_provider" ? (
                    <Pressable style={styles.selectAction} onPress={handleSelectProvider}>
                      <Text style={styles.selectActionText}>Select provider from profile</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.helperText}>
                      Review the warnings above before assigning this provider.
                    </Text>
                  )
                ) : null}
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <Text style={styles.sectionLine}>Phone: {profile.phone ?? "n/a"}</Text>
              <Text style={styles.sectionLine}>Email: {profile.email ?? "n/a"}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <Text style={styles.sectionLine}>{profile.availabilitySummary.label}</Text>
              <Text style={styles.sectionLine}>
                Next open slot: {profile.availabilitySummary.nextOpenSlot ?? "n/a"}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Provider scorecard</Text>
              <Text style={styles.sectionLine}>Status badge: {profile.scorecard.statusBadge}</Text>
              <Text style={styles.sectionLine}>
                Availability label: {profile.scorecard.availabilityLabel}
              </Text>
              <Text style={styles.sectionLine}>
                Completed jobs: {String(profile.scorecard.completedJobs)}
              </Text>
              <Text style={styles.sectionLine}>
                Response time: {profile.scorecard.responseTimeHours}h
              </Text>
              <Text style={styles.sectionLine}>
                Customer score: {profile.scorecard.customerScoreLabel}
              </Text>
              <Text style={styles.sectionLine}>
                Coverage count: {String(profile.scorecard.coverageCount)}
              </Text>
              <Text style={styles.sectionLine}>
                Services count: {String(profile.scorecard.servicesCount)}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Services</Text>
              <Text style={styles.sectionBody}>
                {profile.services.length > 0 ? profile.services.join(", ") : "No services declared."}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Coverage</Text>
              <Text style={styles.sectionBody}>
                {profile.coverage.length > 0 ? profile.coverage.join(", ") : "No coverage declared."}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Metrics</Text>
              <Text style={styles.sectionLine}>
                Completed jobs: {String(profile.metrics.completedJobs)}
              </Text>
              <Text style={styles.sectionLine}>
                Response time: {profile.metrics.responseTimeHours}h
              </Text>
              <Text style={styles.sectionLine}>
                Customer score: {profile.metrics.customerScoreLabel}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contract diagnostics</Text>
              <Text style={styles.sectionLine}>Contract: {profile.meta.contract}</Text>
              <Text style={styles.sectionLine}>Source: {profile.meta.source}</Text>
              <Text style={styles.sectionLine}>
                Assignment-aware: {profile.assignmentFit ? "yes" : "no"}
              </Text>
            </View>
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
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  feedbackCard: {
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  feedbackBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
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
  selectionContextCard: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  selectionContextTitle: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  scorecardCard: {
    borderWidth: 1,
  },
  scorecardRecommended: {
    borderColor: colors.accent,
  },
  scorecardWarning: {
    borderColor: colors.warning,
  },
  scorecardUnavailable: {
    borderColor: colors.danger,
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    marginRight: spacing.sm,
  },
  providerName: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: "700",
  },
  providerMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  ratingBadge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  ratingBadgeText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  sectionBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  scorecardLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  scorecardList: {
    marginTop: spacing.sm,
  },
  scorecardReason: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  scorecardWarningText: {
    color: colors.warning,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  selectionNotice: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  selectionNoticeText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
  selectAction: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  sectionLine: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
});

export default ProviderProfileScreen;
