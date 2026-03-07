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
import { ApiError } from "../api/client";
import {
  fetchProviderAvailability,
  type AvailabilityDay,
  type AvailabilitySlot,
  type ProviderAvailability,
  updateProviderAvailability,
} from "../api/providerAvailabilityApi";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type AvailabilityNavigation = NativeStackNavigationProp<RootStackParamList, "AvailabilityShell">;

const DEFAULT_PROVIDER_ID = "1";
const FALLBACK_TIMEZONE = "Europe/Madrid";

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

const toUiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Session is unauthorized. Recover session and try again.";
    }
    if (error.status === 403) {
      return "Current role cannot edit availability in this context.";
    }
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hydrateDraft = useCallback((next: ProviderAvailability) => {
    setDraftTimezone(next.timezone);
    setDraftSlots(cloneSlots(next.slots));
  }, []);

  const loadAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const next = await fetchProviderAvailability(DEFAULT_PROVIDER_ID);
      setAvailability(next);
      hydrateDraft(next);
    } catch (loadError) {
      setError(toUiError(loadError));
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
    if (!availability) {
      return;
    }
    setError(null);
    setSuccess(null);
    hydrateDraft(availability);
    setIsEditing(true);
  }, [availability, hydrateDraft]);

  const onCancelEditing = useCallback(() => {
    if (availability) {
      hydrateDraft(availability);
    }
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  }, [availability, hydrateDraft]);

  const onSave = useCallback(async () => {
    if (!availability || !hasDraftChanges) {
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
      setSuccess(`Availability updated at ${new Date(updated.updatedAt).toLocaleTimeString()}.`);
    } catch (saveError) {
      setError(toUiError(saveError));
    } finally {
      setIsSaving(false);
    }
  }, [availability, draftSlots, draftTimezone, hasDraftChanges, hydrateDraft]);

  const renderSlotEditor = (slot: AvailabilitySlot) => {
    return (
      <View key={slot.day} style={styles.slotRow}>
        <Text style={styles.slotLabel}>{DAY_LABELS[slot.day]}</Text>

        <View style={styles.slotEditor}>
          <TextInput
            style={[styles.timeInput, styles.timeInputStart, !isEditing && styles.timeInputReadonly]}
            value={slot.start}
            onChangeText={(value) => updateSlot(slot.day, { start: value })}
            editable={isEditing}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="08:00"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.timeDivider}>-</Text>
          <TextInput
            style={[styles.timeInput, styles.timeInputEnd, !isEditing && styles.timeInputReadonly]}
            value={slot.end}
            onChangeText={(value) => updateSlot(slot.day, { end: value })}
            editable={isEditing}
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
              !isEditing && styles.enabledBadgeReadonly,
            ]}
            onPress={() => {
              if (!isEditing) {
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
                <Text style={styles.metaLabel}>Timezone</Text>
                <TextInput
                  style={[styles.timezoneInput, !isEditing && styles.timeInputReadonly]}
                  value={draftTimezone}
                  onChangeText={setDraftTimezone}
                  editable={isEditing}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Source</Text>
                <Text style={styles.metaValue}>{availability.source}</Text>
              </View>

              <View style={styles.slotList}>{draftSlots.map(renderSlotEditor)}</View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? <Text style={styles.successText}>{success}</Text> : null}

              {!isEditing ? (
                <Pressable style={styles.primaryAction} onPress={onStartEditing}>
                  <Text style={styles.primaryActionText}>Edit Availability</Text>
                </Pressable>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.primaryAction, (!hasDraftChanges || isSaving) && styles.disabledAction]}
                    onPress={() => {
                      void onSave();
                    }}
                    disabled={!hasDraftChanges || isSaving}
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
            </>
          ) : null}

          {!isLoading && !availability ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>{error ?? "Unable to load availability."}</Text>
              <Pressable style={styles.secondaryAction} onPress={() => void loadAvailability()}>
                <Text style={styles.secondaryActionText}>Retry</Text>
              </Pressable>
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
  successText: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "600",
    marginTop: spacing.md,
  },
});

export default AvailabilityShellScreen;
