import React, { useCallback, useState } from "react";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, getApiBaseUrl } from "../api/client";
import {
  AssignmentEvidenceApiError,
  consumeManagerAssignmentSelectionResult,
  fetchManagerAssignmentDetail,
  fetchManagerAssignmentEvidence,
  type ManagerAssignmentEvidenceCategory,
  type ManagerAssignmentEvidenceItem,
  type ManagerAssignmentDetail,
  type ManagerAssignmentStatusAction,
  uploadManagerAssignmentEvidence,
  updateManagerAssignmentStatus,
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

function formatBytes(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
}

type EvidenceViewState =
  | "loading"
  | "empty"
  | "ready"
  | "retryable_error"
  | "not_found"
  | "forbidden"
  | "session_expired";

const EVIDENCE_CATEGORY_OPTIONS: Array<{
  value: ManagerAssignmentEvidenceCategory;
  label: string;
}> = [
  { value: "before_photo", label: "Before photo" },
  { value: "after_photo", label: "After photo" },
  { value: "invoice", label: "Invoice" },
  { value: "report", label: "Report" },
  { value: "permit", label: "Permit" },
  { value: "other", label: "Other" },
];

const ManagerAssignmentDetailScreen = () => {
  const navigation = useNavigation<AssignmentDetailNavigation>();
  const route = useRoute<AssignmentDetailRoute>();
  const { queueItemId } = route.params;

  const [detail, setDetail] = useState<ManagerAssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<ManagerAssignmentStatusAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [evidenceItems, setEvidenceItems] = useState<ManagerAssignmentEvidenceItem[]>([]);
  const [evidenceViewState, setEvidenceViewState] = useState<EvidenceViewState>("loading");
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceUploadOpen, setEvidenceUploadOpen] = useState(false);
  const [evidenceUploadPending, setEvidenceUploadPending] = useState(false);
  const [evidenceUploadMessage, setEvidenceUploadMessage] = useState<string | null>(null);
  const [evidenceUploadNote, setEvidenceUploadNote] = useState("");
  const [evidenceUploadCategory, setEvidenceUploadCategory] =
    useState<ManagerAssignmentEvidenceCategory>("before_photo");

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

  const loadEvidence = useCallback(async () => {
    setEvidenceViewState("loading");
    setEvidenceError(null);
    try {
      const payload = await fetchManagerAssignmentEvidence(queueItemId);
      setEvidenceItems(payload.items);
      setEvidenceViewState(payload.count > 0 ? "ready" : "empty");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        if (requestError.status === 401) {
          setEvidenceViewState("session_expired");
          navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
          return;
        }
        if (requestError.status === 403) {
          setEvidenceViewState("forbidden");
          navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
          return;
        }
        if (requestError.status === 404) {
          setEvidenceItems([]);
          setEvidenceError("Queue item not found for assignment evidence.");
          setEvidenceViewState("not_found");
          return;
        }
      }

      const message =
        requestError instanceof Error ? requestError.message : "Unable to load assignment evidence.";
      setEvidenceItems([]);
      setEvidenceError(message);
      setEvidenceViewState("retryable_error");
    }
  }, [navigation, queueItemId]);

  const runAssignmentAction = useCallback(
    async (
      action: ManagerAssignmentStatusAction,
      options?: {
        providerId?: string;
        successMessage?: string;
      }
    ) => {
      if (!detail) {
        return;
      }

      setActionPending(action);
      setActionMessage(null);
      try {
        await updateManagerAssignmentStatus(detail.item.id, {
          action,
          providerId: options?.providerId,
          note: actionNote,
        });
        await Promise.all([loadDetail(), loadEvidence()]);
        setActionMessage(
          options?.successMessage ??
            (action === "complete"
              ? "Assignment completed."
              : action === "cancel"
                ? "Assignment cancelled."
                : "Provider reassigned successfully.")
        );
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
          requestError instanceof Error ? requestError.message : "Unable to update assignment.";
        setActionMessage(message);
      } finally {
        setActionPending(null);
      }
    },
    [actionNote, detail, loadDetail, loadEvidence, navigation]
  );

  const openEvidenceUrl = useCallback(
    async (target: string | null) => {
      if (!target) {
        return;
      }

      const url = target.startsWith("http")
        ? target
        : `${getApiBaseUrl().replace(/\/api$/, "")}${target}`;
      await Linking.openURL(url);
    },
    []
  );

  const handleEvidenceUpload = useCallback(async () => {
    setEvidenceUploadPending(true);
    setEvidenceUploadMessage(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ["image/*", "application/pdf", "text/plain"],
      });

      if (result.canceled || result.assets.length === 0) {
        setEvidenceUploadPending(false);
        return;
      }

      const selected = result.assets[0];
      const payload = await uploadManagerAssignmentEvidence(queueItemId, {
        category: evidenceUploadCategory,
        note: evidenceUploadNote,
        file: {
          uri: selected.uri,
          name: selected.name,
          mimeType: selected.mimeType ?? "application/octet-stream",
        },
      });

      setEvidenceItems(payload.items);
      setEvidenceViewState(payload.count > 0 ? "ready" : "empty");
      setEvidenceUploadMessage("Evidence uploaded successfully.");
      setEvidenceUploadOpen(false);
      setEvidenceUploadNote("");
    } catch (requestError) {
      if (requestError instanceof AssignmentEvidenceApiError) {
        if (requestError.status === 401) {
          navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
          return;
        }
        if (requestError.status === 403) {
          navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
          return;
        }

        if (requestError.status === 413) {
          setEvidenceUploadMessage(
            `File too large. Max ${formatBytes(requestError.maxSizeBytes ?? 0)} supported.`
          );
        } else if (requestError.status === 415) {
          setEvidenceUploadMessage(
            `Unsupported file type${requestError.mediaType ? `: ${requestError.mediaType}` : ""}.`
          );
        } else if (requestError.status === 422) {
          const fileValidation = requestError.fields.file?.[0];
          const categoryValidation = requestError.fields.category?.[0];
          setEvidenceUploadMessage(fileValidation ?? categoryValidation ?? requestError.message);
        } else {
          setEvidenceUploadMessage(requestError.message);
        }
      } else {
        setEvidenceUploadMessage(
          requestError instanceof Error ? requestError.message : "Unable to upload evidence."
        );
      }
    } finally {
      setEvidenceUploadPending(false);
    }
  }, [evidenceUploadCategory, evidenceUploadNote, navigation, queueItemId]);

  useFocusEffect(
    useCallback(() => {
      const pendingSelection = consumeManagerAssignmentSelectionResult(queueItemId);
      if (pendingSelection) {
        void runAssignmentAction("reassign", {
          providerId: pendingSelection.providerId,
          successMessage: `${pendingSelection.providerName} assigned successfully.`,
        });
      } else {
        void Promise.all([loadDetail(), loadEvidence()]);
      }
      return undefined;
    }, [loadDetail, loadEvidence, queueItemId, runAssignmentAction])
  );

  const openReassignFlow = useCallback(() => {
    if (!detail) {
      return;
    }

    navigation.navigate("ProviderDirectory", {
      selectionContext: {
        queueItemId: detail.item.id,
        propertyTitle: detail.property?.title ?? detail.item.propertyTitle,
        currentProviderId: detail.provider?.id,
      },
    });
  }, [detail, navigation]);

  const canRunAction = useCallback(
    (action: ManagerAssignmentStatusAction) =>
      detail?.availableActions.includes(action) === true && actionPending === null,
    [actionPending, detail?.availableActions]
  );

  const renderActionLabel = useCallback(
    (action: ManagerAssignmentStatusAction) => {
      if (actionPending === action) {
        if (action === "reassign") {
          return "Reassigning...";
        }
        if (action === "cancel") {
          return "Cancelling...";
        }
        return "Completing...";
      }

      if (action === "reassign") {
        return "Reassign provider";
      }
      if (action === "cancel") {
        return "Cancel assignment";
      }
      return "Complete assignment";
    },
    [actionPending]
  );

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
              <Text style={styles.meta}>State: {detail.assignment?.state ?? "unassigned"}</Text>
              <Text style={styles.meta}>
                Assigned: {detail.assignment?.assigned ? "Yes" : "No"}
              </Text>
              <Text style={styles.meta}>
                Assigned at: {formatIsoDate(detail.assignment?.assignedAt ?? null)}
              </Text>
              <Text style={styles.meta}>
                Completed at: {formatIsoDate(detail.assignment?.completedAt ?? null)}
              </Text>
              <Text style={styles.meta}>
                Cancelled at: {formatIsoDate(detail.assignment?.cancelledAt ?? null)}
              </Text>
              <Text style={styles.meta}>Note: {detail.assignment?.note ?? "-"}</Text>
              <Text style={styles.meta}>
                Available actions:{" "}
                {detail.availableActions.length > 0 ? detail.availableActions.join(", ") : "none"}
              </Text>
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
                  : "Select a provider if reassignment is available."}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Assignment actions</Text>
              <TextInput
                value={actionNote}
                onChangeText={setActionNote}
                placeholder="Optional action note"
                placeholderTextColor={colors.textMuted}
                style={styles.noteInput}
              />

              {detail.availableActions.includes("reassign") ? (
                <Pressable
                  style={[styles.primaryAction, !canRunAction("reassign") && styles.actionDisabled]}
                  disabled={!canRunAction("reassign")}
                  onPress={openReassignFlow}
                >
                  <Text style={styles.primaryActionText}>{renderActionLabel("reassign")}</Text>
                </Pressable>
              ) : null}

              {detail.availableActions.includes("complete") ? (
                <Pressable
                  style={[
                    styles.secondaryAction,
                    !canRunAction("complete") && styles.actionDisabled,
                  ]}
                  disabled={!canRunAction("complete")}
                  onPress={() => void runAssignmentAction("complete")}
                >
                  <Text style={styles.secondaryActionText}>{renderActionLabel("complete")}</Text>
                </Pressable>
              ) : null}

              {detail.availableActions.includes("cancel") ? (
                <Pressable
                  style={[styles.dangerAction, !canRunAction("cancel") && styles.actionDisabled]}
                  disabled={!canRunAction("cancel")}
                  onPress={() => void runAssignmentAction("cancel")}
                >
                  <Text style={styles.dangerActionText}>{renderActionLabel("cancel")}</Text>
                </Pressable>
              ) : null}
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

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Assignment evidence</Text>
                  <Text style={styles.helperText}>
                    Review uploaded media/documents and add more evidence without leaving this detail.
                  </Text>
                </View>
                <Pressable
                  style={styles.inlineAction}
                  onPress={() => setEvidenceUploadOpen((previous) => !previous)}
                  disabled={evidenceUploadPending}
                >
                  <Text style={styles.inlineActionText}>
                    {evidenceUploadOpen ? "Close upload" : "Add evidence"}
                  </Text>
                </Pressable>
              </View>

              {evidenceUploadOpen ? (
                <View style={styles.uploadComposer}>
                  <Text style={styles.composerLabel}>Evidence category</Text>
                  <View style={styles.categoryWrap}>
                    {EVIDENCE_CATEGORY_OPTIONS.map((option) => (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.categoryChip,
                          evidenceUploadCategory === option.value && styles.categoryChipActive,
                        ]}
                        onPress={() => setEvidenceUploadCategory(option.value)}
                        disabled={evidenceUploadPending}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            evidenceUploadCategory === option.value && styles.categoryChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={evidenceUploadNote}
                    onChangeText={setEvidenceUploadNote}
                    placeholder="Optional evidence note"
                    placeholderTextColor={colors.textMuted}
                    style={styles.noteInput}
                    editable={!evidenceUploadPending}
                  />
                  <Pressable
                    style={[styles.primaryAction, evidenceUploadPending && styles.actionDisabled]}
                    disabled={evidenceUploadPending}
                    onPress={() => void handleEvidenceUpload()}
                  >
                    <Text style={styles.primaryActionText}>
                      {evidenceUploadPending ? "Uploading..." : "Choose file and upload"}
                    </Text>
                  </Pressable>
                  {evidenceUploadMessage ? (
                    <Text
                      style={[
                        styles.actionMessage,
                        evidenceUploadMessage.toLowerCase().includes("success")
                          ? styles.successMessage
                          : styles.errorMessageInline,
                      ]}
                    >
                      {evidenceUploadMessage}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {evidenceViewState === "loading" ? (
                <View style={styles.evidenceFeedbackWrap}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.meta}>Loading assignment evidence...</Text>
                </View>
              ) : null}

              {evidenceViewState === "empty" ? (
                <Text style={styles.meta}>No evidence uploaded yet.</Text>
              ) : null}

              {evidenceViewState === "not_found" ? (
                <Text style={styles.errorText}>
                  {evidenceError ?? "Assignment evidence is not available for this queue item."}
                </Text>
              ) : null}

              {evidenceViewState === "retryable_error" ? (
                <View style={styles.evidenceFeedbackWrap}>
                  <Text style={styles.errorText}>
                    {evidenceError ?? "Unable to load assignment evidence."}
                  </Text>
                  <Pressable style={styles.secondaryAction} onPress={() => void loadEvidence()}>
                    <Text style={styles.secondaryActionText}>Retry evidence fetch</Text>
                  </Pressable>
                </View>
              ) : null}

              {evidenceViewState === "ready" ? (
                <View style={styles.evidenceListWrap}>
                  {evidenceItems.map((item) => (
                    <View key={item.id} style={styles.evidenceItem}>
                      <Text style={styles.timelineTitle}>{item.fileName}</Text>
                      <Text style={styles.timelineMeta}>
                        {item.category} | {item.mediaType} | {formatBytes(item.sizeBytes)}
                      </Text>
                      <Text style={styles.timelineMeta}>
                        Uploaded by {item.uploadedBy} on {formatIsoDate(item.uploadedAt)}
                      </Text>
                      {item.note ? <Text style={styles.meta}>Note: {item.note}</Text> : null}
                      <View style={styles.evidenceActions}>
                        {item.previewUrl ? (
                          <Pressable
                            style={styles.inlineLinkAction}
                            onPress={() => void openEvidenceUrl(item.previewUrl)}
                          >
                            <Text style={styles.inlineLinkText}>Preview</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          style={styles.inlineLinkAction}
                          onPress={() => void openEvidenceUrl(item.downloadUrl)}
                        >
                          <Text style={styles.inlineLinkText}>Download</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
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

            {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}
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
  helperText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  inlineAction: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineActionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "700",
  },
  uploadComposer: {
    marginTop: spacing.md,
  },
  composerLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryChip: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  categoryChipText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: colors.surface,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  noteInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  evidenceListWrap: {
    marginTop: spacing.md,
  },
  evidenceItem: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  evidenceActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  inlineLinkAction: {
    paddingVertical: spacing.xs,
  },
  inlineLinkText: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  evidenceFeedbackWrap: {
    marginTop: spacing.md,
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
  dangerAction: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  dangerActionText: {
    color: colors.surface,
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
  successMessage: {
    color: colors.accent,
  },
  errorMessageInline: {
    color: colors.danger,
  },
});

export default ManagerAssignmentDetailScreen;
