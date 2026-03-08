import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
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
import { getSessionIdentitySnapshot, handleUnauthorizedSession } from "../auth/session";
import {
  fetchProviderAvailability,
  type AvailabilityDay,
  type AvailabilitySlot,
  type ProviderAvailability,
  ProviderAvailabilityApiError,
  updateProviderAvailability,
} from "../api/providerAvailabilityApi";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type AvailabilityNavigation = NativeStackNavigationProp<RootStackParamList, "AvailabilityShell">;

const FALLBACK_TIMEZONE = "Europe/Madrid";

type AccessState =
  | "editable"
  | "identity-missing"
  | "identity-mismatch"
  | "role-forbidden"
  | "unauthorized";

const DAY_LABELS: Record<AvailabilityDay, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const cloneSlots = (slots: AvailabilitySlot[]): AvailabilitySlot[] =>
  slots.map((slot) => ({
    day: slot.day,
    start: slot.start,
    end: slot.end,
    enabled: slot.enabled,
  }));

const toAccessState = (error: unknown): AccessState => {
  if (!(error instanceof ProviderAvailabilityApiError)) {
    return "editable";
  }

  if (error.status === 401) {
    return "unauthorized";
  }

  if (error.status === 403 && error.code === "PROVIDER_IDENTITY_MISMATCH") {
    return "identity-mismatch";
  }

  if (error.status === 403 && error.code === "ROLE_SCOPE_FORBIDDEN") {
    return "role-forbidden";
  }

  return "editable";
};

const toUiError = (error: unknown, state: AccessState): string => {
  if (state === "identity-missing") {
    return "Session has no provider identity. Recover session to continue.";
  }
  if (state === "identity-mismatch") {
    return "Ownership mismatch detected. You can only edit your own provider availability.";
  }
  if (state === "role-forbidden") {
    return "Your current role is read-only for availability updates.";
  }
  if (state === "unauthorized") {
    return "Session is unauthorized or expired. Recover session and retry.";
  }

  if (error instanceof ProviderAvailabilityApiError) {
    if (error.status === 422) {
      return "Invalid schedule format. Use HH:mm and ensure end > start.";
    }
    if (error.status === 408) {
      return "Request timed out. Check API connectivity and retry.";
    }
    return error.message.trim().length > 0 ? error.message : `Request failed (${error.status}).`;
  }

  return "Unexpected availability error.";
};

const AvailabilityShellScreen = () => {
  const navigation = useNavigation<AvailabilityNavigation>();
  const [availability, setAvailability] = useState<ProviderAvailability | null>(null);
  const [draftTimezone, setDraftTimezone] = useState(FALLBACK_TIMEZONE);
  const [draftSlots, setDraftSlots] = useState<AvailabilitySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("editable");
  const [sessionProviderId, setSessionProviderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEditAvailability = accessState === "editable";
  const showLockedState = accessState !== "editable";

  const hydrateDraft = useCallback((next: ProviderAvailability) => {
    setDraftTimezone(next.timezone);
    setDraftSlots(cloneSlots(next.slots));
  }, []);

  const loadAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const identity = getSessionIdentitySnapshot();
    setSessionProviderId(identity.providerId);

    if (!identity.hasToken || !identity.providerId) {
      setAvailability(null);
      setIsEditing(false);
      setAccessState("identity-missing");
      setError(toUiError(null, "identity-missing"));
      setIsLoading(false);
      return;
    }

    try {
      const next = await fetchProviderAvailability(identity.providerId);
      setAvailability(next);
      hydrateDraft(next);
      setAccessState("editable");
    } catch (loadError) {
      const nextAccessState = toAccessState(loadError);
      setAccessState(nextAccessState);
      setIsEditing(false);
      setError(toUiError(loadError, nextAccessState));
    } finally {
      setIsLoading(false);
    }
  }, [hydrateDraft]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const hasDraftChanges = useMemo(() => {
    if (!availability) {
      return false;
    }

    if (draftTimezone.trim() !== availability.timezone.trim()) {
      return true;
    }

    const current = JSON.stringify(availability.slots);
    const draft = JSON.stringify(draftSlots);
    return current !== draft;
  }, [availability, draftSlots, draftTimezone]);

  const updateSlot = useCallback((day: AvailabilityDay, patch: Partial<AvailabilitySlot>) => {
    setDraftSlots((previous) =>
      previous.map((slot) => (slot.day === day ? { ...slot, ...patch } : slot))
    );
  }, []);

  const onStartEditing = useCallback(() => {
    if (!availability || !canEditAvailability) {
      return;
    }
    setError(null);
    setSuccess(null);
    hydrateDraft(availability);
    setIsEditing(true);
  }, [availability, canEditAvailability, hydrateDraft]);

  const onCancelEditing = useCallback(() => {
    if (availability) {
      hydrateDraft(availability);
    }
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  }, [availability, hydrateDraft]);

  const onSave = useCallback(async () => {
    if (!availability || !hasDraftChanges || !canEditAvailability) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateProviderAvailability(availability.providerId, {
        timezone: draftTimezone.trim() || FALLBACK_TIMEZONE,
        slots: draftSlots,
      });

      const next: ProviderAvailability = {
        providerId: updated.providerId,
        timezone: updated.timezone,
        slots: cloneSlots(updated.slots),
        source: updated.source,
      };

      setAvailability(next);
      hydrateDraft(next);
      setIsEditing(false);
      setAccessState("editable");
      setSuccess(`Availability updated at ${new Date(updated.updatedAt).toLocaleTimeString()}.`);
    } catch (saveError) {
      const nextAccessState = toAccessState(saveError);
      setAccessState(nextAccessState);
      setIsEditing(false);
      setError(toUiError(saveError, nextAccessState));
    } finally {
      setIsSaving(false);
    }
  }, [availability, canEditAvailability, draftSlots, draftTimezone, hasDraftChanges, hydrateDraft]);

  const renderSlotEditor = (slot: AvailabilitySlot) => {
    return (
      <View key={slot.day} style={styles.slotRow}>
        <Text style={styles.slotLabel}>{DAY_LABELS[slot.day]}</Text>

        <View style={styles.slotEditor}>
          <TextInput
            style={[styles.timeInput, styles.timeInputStart, (!isEditing || !canEditAvailability) && styles.timeInputReadonly]}
            value={slot.start}
            onChangeText={(value) => updateSlot(slot.day, { start: value })}
            editable={isEditing && canEditAvailability}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="08:00"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.timeDivider}>-</Text>
          <TextInput
            style={[styles.timeInput, styles.timeInputEnd, (!isEditing || !canEditAvailability) && styles.timeInputReadonly]}
            value={slot.end}
            onChangeText={(value) => updateSlot(slot.day, { end: value })}
            editable={isEditing && canEditAvailability}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="12:00"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            style={[
              styles.enabledBadge,
              styles.enabledBadgeSpacing,
              slot.enabled ? styles.enabledBadgeActive : styles.enabledBadgeMuted,
              (!isEditing || !canEditAvailability) && styles.enabledBadgeReadonly,
            ]}
            onPress={() => {
              if (!isEditing || !canEditAvailability) {
                return;
              }
              updateSlot(slot.day, { enabled: !slot.enabled });
            }}
          >
            <Text style={styles.enabledBadgeText}>{slot.enabled ? "On" : "Off"}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Availability Management</Text>
          <Text style={styles.body}>
            Configure weekly schedule slots for provider service coverage and publish updates to API.
          </Text>

          {isLoading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.loadingText}>Loading availability...</Text>
            </View>
          ) : null}

          {!isLoading && availability ? (
            <>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Session Provider</Text>
                <Text style={styles.metaValue}>{sessionProviderId ?? "missing"}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Timezone</Text>
                <TextInput
                  style={[styles.timezoneInput, (!isEditing || !canEditAvailability) && styles.timeInputReadonly]}
                  value={draftTimezone}
                  onChangeText={setDraftTimezone}
                  editable={isEditing && canEditAvailability}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Source</Text>
                <Text style={styles.metaValue}>{availability.source}</Text>
              </View>

              <View style={styles.slotList}>{draftSlots.map(renderSlotEditor)}</View>

              {showLockedState ? (
                <Text style={styles.lockedStateText}>
                  {accessState === "identity-mismatch"
                    ? "Read-only: provider ownership mismatch."
                    : accessState === "role-forbidden"
                      ? "Read-only: role scope does not allow availability edits."
                      : accessState === "unauthorized"
                        ? "Session unauthorized. Recover to continue editing."
                        : "Session identity is incomplete. Recover to continue editing."}
                </Text>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? <Text style={styles.successText}>{success}</Text> : null}

              {!isEditing ? (
                <Pressable
                  style={[styles.primaryAction, !canEditAvailability && styles.disabledAction]}
                  onPress={onStartEditing}
                  disabled={!canEditAvailability}
                >
                  <Text style={styles.primaryActionText}>Edit Availability</Text>
                </Pressable>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[
                      styles.primaryAction,
                      (!hasDraftChanges || isSaving || !canEditAvailability) && styles.disabledAction,
                    ]}
                    onPress={() => {
                      void onSave();
                    }}
                    disabled={!hasDraftChanges || isSaving || !canEditAvailability}
                  >
                    <Text style={styles.primaryActionText}>{isSaving ? "Saving..." : "Save Changes"}</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.secondaryAction, styles.secondaryActionSpacing]}
                    onPress={onCancelEditing}
                    disabled={isSaving}
                  >
                    <Text style={styles.secondaryActionText}>Cancel</Text>
                  </Pressable>
                </View>
              )}

              {accessState === "identity-mismatch" || accessState === "role-forbidden" ? (
                <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate("ProviderDashboard")}>
                  <Text style={styles.secondaryActionText}>Back to Dashboard</Text>
                </Pressable>
              ) : null}

              {accessState === "identity-missing" || accessState === "unauthorized" ? (
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() => {
                    handleUnauthorizedSession();
                    navigation.navigate("ProviderUnauthorized");
                  }}
                >
                  <Text style={styles.secondaryActionText}>Recover Session</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {!isLoading && !availability ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{error ?? "Unable to load availability."}</Text>
              {accessState === "identity-missing" || accessState === "unauthorized" ? (
                <Pressable
                  style={styles.secondaryAction}
                  onPress={() => {
                    handleUnauthorizedSession();
                    navigation.navigate("ProviderUnauthorized");
                  }}
                >
                  <Text style={styles.secondaryActionText}>Recover Session</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryAction} onPress={() => void loadAvailability()}>
                  <Text style={styles.secondaryActionText}>Retry</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <Pressable style={styles.ghostAction} onPress={() => navigation.navigate("ProviderDashboard")}>
            <Text style={styles.ghostActionText}>Back to Dashboard</Text>
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
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
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
  loadingBlock: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  timezoneInput: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    minWidth: 150,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: "right",
  },
  slotList: {
    marginTop: spacing.md,
  },
  slotRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  slotLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    width: 44,
  },
  slotEditor: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  timeInput: {
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    minWidth: 62,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
  timeInputStart: {
    marginRight: spacing.xs,
  },
  timeInputEnd: {
    marginLeft: spacing.xs,
  },
  timeInputReadonly: {
    backgroundColor: colors.background,
    color: colors.textMuted,
  },
  timeDivider: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  enabledBadge: {
    borderRadius: borderRadius.md,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  enabledBadgeSpacing: {
    marginLeft: spacing.xs,
  },
  enabledBadgeActive: {
    backgroundColor: colors.brand,
  },
  enabledBadgeMuted: {
    backgroundColor: colors.border,
  },
  enabledBadgeReadonly: {
    opacity: 0.8,
  },
  enabledBadgeText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textAlign: "center",
  },
  actionRow: {
    marginTop: spacing.lg,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabledAction: {
    opacity: 0.55,
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
  secondaryActionSpacing: {
    marginTop: spacing.sm,
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  ghostAction: {
    alignItems: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  ghostActionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  errorBlock: {
    marginTop: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: "600",
    marginTop: spacing.md,
  },
  lockedStateText: {
    color: colors.warning,
    fontSize: fontSizes.sm,
    fontWeight: "600",
    marginTop: spacing.md,
  },
  successText: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "600",
    marginTop: spacing.md,
  },
});

export default AvailabilityShellScreen;
