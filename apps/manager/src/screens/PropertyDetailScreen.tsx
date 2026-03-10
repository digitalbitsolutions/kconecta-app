import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
import {
  fetchPropertyById,
  releaseProperty,
  reserveProperty,
  updatePropertyStatus,
  type PropertyStatus,
  type PropertyViewModel,
} from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyDetailRoute = RouteProp<ManagerStackParamList, "PropertyDetail">;
type PropertyDetailNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyDetail">;

const statusOptions: PropertyStatus[] = ["available", "reserved", "maintenance"];

const PropertyDetailScreen = () => {
  const navigation = useNavigation<PropertyDetailNavigation>();
  const route = useRoute<PropertyDetailRoute>();
  const { propertyId, propertyTitle } = route.params;

  const [property, setProperty] = useState<PropertyViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationLoading, setMutationLoading] = useState<boolean>(false);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

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

  useEffect(() => {
    loadProperty();
  }, [loadProperty]);

  const executeMutation = useCallback(
    async (successMessage: string, action: () => Promise<PropertyViewModel>) => {
      setMutationLoading(true);
      setMutationError(null);
      setMutationMessage(null);

      try {
        const updated = await action();
        setProperty(updated);
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
    [navigation]
  );

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
              conflict/forbidden/session handling.
            </Text>
          </View>
        </>
      ) : null}
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
    padding: spacing.lg,
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
    padding: spacing.lg,
  },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "600",
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


