import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import {
  fetchPropertyAssignmentContext,
  fetchPropertyById,
  releaseProperty,
  reserveProperty,
  type PropertyAssignmentContext,
  type PropertyDetailViewModel,
  updatePropertyStatus,
  type PropertyStatus,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyDetailRoute = RouteProp<ManagerStackParamList, "PropertyDetail">;
type PropertyDetailNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyDetail">;

const statusOptions: PropertyStatus[] = ["available", "reserved", "maintenance"];
const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number | null): string {
  return typeof value === "number" ? currencyFormatter.format(value) : "n/a";
}

function formatNullable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }
  return String(value);
}

function formatBoolean(value: boolean | null): string {
  if (value === true) {
    return "Yes";
  }
  if (value === false) {
    return "No";
  }
  return "Unknown";
}

const PropertyDetailScreen = () => {
  const navigation = useNavigation<PropertyDetailNavigation>();
  const route = useRoute<PropertyDetailRoute>();
  const { propertyId, propertyTitle } = route.params;

  const [property, setProperty] = useState<PropertyDetailViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationLoading, setMutationLoading] = useState<boolean>(false);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [assignmentContext, setAssignmentContext] = useState<PropertyAssignmentContext | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<boolean>(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [timelineRefreshing, setTimelineRefreshing] = useState<boolean>(false);

  const loadProperty = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchPropertyById(propertyId);
      setProperty(payload);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load property.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  const loadAssignmentContext = useCallback(async () => {
    setAssignmentLoading(true);
    setAssignmentError(null);
    try {
      const payload = await fetchPropertyAssignmentContext(propertyId);
      setAssignmentContext(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load assignment context.";
      setAssignmentError(message);
      setAssignmentContext(null);
    } finally {
      setAssignmentLoading(false);
    }
  }, [propertyId]);

  useFocusEffect(
    useCallback(() => {
      void loadProperty();
      void loadAssignmentContext();
      return undefined;
    }, [loadAssignmentContext, loadProperty])
  );

  const executeMutation = useCallback(
    async (successMessage: string, action: () => Promise<unknown>) => {
      setMutationLoading(true);
      setMutationError(null);
      setMutationMessage(null);

      try {
        await action();
        await Promise.all([loadProperty(), loadAssignmentContext()]);
        setMutationMessage(successMessage);
      } catch (mutationFailure) {
        if (mutationFailure instanceof ApiError) {
          if (mutationFailure.status === 401) {
            navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
            return;
          }
          if (mutationFailure.status === 403) {
            navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
            return;
          }

          if (mutationFailure.status === 409) {
            setMutationError(`Conflict: ${mutationFailure.message}`);
            return;
          }
        }

        const message = mutationFailure instanceof Error ? mutationFailure.message : "Property action failed.";
        setMutationError(message);
      } finally {
        setMutationLoading(false);
      }
    },
    [loadAssignmentContext, loadProperty, navigation]
  );

  const refreshTimeline = useCallback(async () => {
    setTimelineRefreshing(true);
    try {
      const payload = await fetchPropertyById(propertyId);
      setProperty(payload);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : "Unable to refresh timeline.";
      setMutationError(message);
    } finally {
      setTimelineRefreshing(false);
    }
  }, [propertyId]);

  const formatTimelineSubtitle = useCallback((occurredAt: string, actor: string): string => {
    const timestamp = new Date(occurredAt);
    const formattedTimestamp = Number.isNaN(timestamp.getTime())
      ? occurredAt
      : timestamp.toLocaleString("es-ES");
    return `${actor} | ${formattedTimestamp}`;
  }, []);

  const reserveOrReleaseLabel = property?.status === "reserved" ? "Release Reservation" : "Reserve Property";

  const onReserveOrRelease = useCallback(() => {
    if (!property) {
      return;
    }

    if (property.status === "reserved") {
      void executeMutation("Reservation released.", () => releaseProperty(property.id));
      return;
    }

    void executeMutation("Property reserved.", () => reserveProperty(property.id));
  }, [executeMutation, property]);

  const statusActionOptions = useMemo(
    () => statusOptions.filter((status) => status !== property?.status),
    [property?.status]
  );

  const onUpdateStatus = useCallback(
    (status: PropertyStatus) => {
      if (!property) {
        return;
      }

      const label = `Status updated to ${status}.`;
      void executeMutation(label, () => updatePropertyStatus(property.id, status));
    },
    [executeMutation, property]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{property?.title ?? propertyTitle}</Text>
          <Text style={styles.heroSubtitle}>Property operational snapshot</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.loadingText}>Loading property detail...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorTitle}>Unable to load property</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadProperty}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && property ? (
          <>
            <View style={styles.infoCard}>
              <Row label="Property ID" value={property.id} />
              <Row label="City" value={property.city} />
              <Row label="Status" value={property.status} highlight />
              <Row label="Manager" value={property.managerId} />
              <Row label="Price" value={property.price} />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <Row label="Description" value={formatNullable(property.description)} />
              <Row label="Address" value={formatNullable(property.address)} />
              <Row label="Postal code" value={formatNullable(property.postalCode)} />
              <Row label="Property type" value={formatNullable(property.propertyType)} />
              <Row label="Operation mode" value={formatNullable(property.operationMode)} />
              <Row label="Updated at" value={formatNullable(property.updatedAt)} />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Pricing</Text>
              <Row label="Sale price" value={formatCurrency(property.pricing.salePrice)} />
              <Row label="Rental price" value={formatCurrency(property.pricing.rentalPrice)} />
              <Row label="Garage category" value={formatNullable(property.pricing.garagePriceCategoryId)} />
              <Row label="Garage price" value={formatCurrency(property.pricing.garagePrice)} />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Characteristics</Text>
              <Row label="Bedrooms" value={formatNullable(property.characteristics.bedrooms)} />
              <Row label="Bathrooms" value={formatNullable(property.characteristics.bathrooms)} />
              <Row label="Rooms" value={formatNullable(property.characteristics.rooms)} />
              <Row label="Elevator" value={formatBoolean(property.characteristics.elevator)} />
            </View>

            <View style={styles.assignmentCard}>
              <Text style={styles.assignmentTitle}>Assignment context</Text>
              {assignmentLoading ? (
                <View style={styles.assignmentLoadingWrap}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={styles.assignmentLoadingText}>Refreshing assignment context...</Text>
                </View>
              ) : null}

              {!assignmentLoading && assignmentError ? (
                <>
                  <Text style={styles.assignmentErrorText}>{assignmentError}</Text>
                  <Pressable style={styles.assignmentRetryAction} onPress={loadAssignmentContext}>
                    <Text style={styles.assignmentRetryText}>Retry context fetch</Text>
                  </Pressable>
                </>
              ) : null}

              {!assignmentLoading && !assignmentError && assignmentContext ? (
                <>
                  <Row
                    label="State"
                    value={assignmentContext.state}
                    highlight={assignmentContext.state === "provider_missing"}
                  />
                  <Row label="Assigned" value={assignmentContext.assigned ? "Yes" : "No"} />
                  <Row label="Provider" value={assignmentContext.provider?.name ?? "Not assigned"} />
                  <Row label="Assigned at" value={assignmentContext.assignedAt ?? "-"} />
                  <Row label="Note" value={assignmentContext.note ?? "-"} />
                </>
              ) : null}
            </View>

            <View style={styles.timelineCard}>
              <View style={styles.timelineHeaderRow}>
                <Text style={styles.timelineTitle}>Timeline</Text>
                <Pressable
                  style={[styles.timelineRefreshAction, timelineRefreshing && styles.actionDisabled]}
                  disabled={timelineRefreshing}
                  onPress={refreshTimeline}
                >
                  <Text style={styles.timelineRefreshText}>
                    {timelineRefreshing ? "Refreshing..." : "Refresh"}
                  </Text>
                </Pressable>
              </View>

              {property.timeline.length === 0 ? (
                <Text style={styles.timelineEmptyText}>No timeline events available for this property.</Text>
              ) : (
                property.timeline.map((event) => (
                  <View key={event.id} style={styles.timelineEventCard}>
                    <Text style={styles.timelineEventTitle}>{event.summary}</Text>
                    <Text style={styles.timelineEventMeta}>
                      {formatTimelineSubtitle(event.occurredAt, event.actor)}
                    </Text>
                    <Text style={styles.timelineEventType}>Type: {event.type}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.actionCard}>
              <Text style={styles.actionTitle}>Manager actions</Text>
              <Text style={styles.actionBody}>Run reserve/release and status transitions with API guardrails.</Text>

              <Pressable
                style={[styles.primaryAction, mutationLoading && styles.actionDisabled]}
                disabled={mutationLoading}
                onPress={onReserveOrRelease}
              >
                <Text style={styles.primaryActionText}>
                  {mutationLoading ? "Applying action..." : reserveOrReleaseLabel}
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryAction}
                onPress={() =>
                  navigation.navigate("PropertyEditor", {
                    mode: "edit",
                    propertyId: property.id,
                  })
                }
              >
                <Text style={styles.secondaryActionText}>Edit Property Form</Text>
              </Pressable>

              <Pressable
                style={styles.handoffAction}
                onPress={() =>
                  navigation.navigate("ManagerToProviderHandoff", {
                    propertyId: property.id,
                    propertyTitle: property.title,
                  })
                }
              >
                <Text style={styles.handoffActionText}>Open Provider Handoff</Text>
              </Pressable>

              <View style={styles.statusActionRow}>
                {statusActionOptions.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.statusActionButton, mutationLoading && styles.actionDisabled]}
                    disabled={mutationLoading}
                    onPress={() => onUpdateStatus(status)}
                  >
                    <Text style={styles.statusActionText}>Set {status}</Text>
                  </Pressable>
                ))}
              </View>

              {mutationMessage ? <Text style={styles.feedbackSuccess}>{mutationMessage}</Text> : null}
              {mutationError ? <Text style={styles.feedbackError}>{mutationError}</Text> : null}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Integration status</Text>
              <Text style={styles.noteBody}>
                Property detail now exposes mutation controls connected to manager API endpoints with deterministic
                conflict, forbidden and session handling.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

type RowProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

const Row: React.FC<RowProps> = ({ label, value, highlight = false }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.brand,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: fontSizes.lg,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: colors.brandSoft,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  errorWrap: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
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
  infoCard: {
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
  assignmentCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  assignmentTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  assignmentLoadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  assignmentLoadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  assignmentErrorText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
  },
  assignmentRetryAction: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  assignmentRetryText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
  timelineCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  timelineHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  timelineTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  timelineRefreshAction: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  timelineRefreshText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "700",
  },
  timelineEmptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  timelineEventCard: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  timelineEventTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  timelineEventMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  timelineEventType: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
    textTransform: "capitalize",
  },
  row: {
    alignItems: "flex-start",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    maxWidth: "38%",
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "600",
    flexShrink: 1,
    maxWidth: "58%",
    textAlign: "right",
  },
  rowValueHighlight: {
    color: colors.accent,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  actionBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
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
    fontWeight: "600",
  },
  handoffAction: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  handoffActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  statusActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
  },
  statusActionButton: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusActionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
  actionDisabled: {
    opacity: 0.6,
  },
  feedbackSuccess: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  feedbackError: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  noteTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  noteBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
});

export default PropertyDetailScreen;



