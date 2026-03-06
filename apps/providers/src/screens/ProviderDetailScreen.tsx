import React, { useCallback, useEffect, useState } from "react";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { fetchProviderById, type ProviderViewModel } from "../api/providerApi";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type ProviderDetailRoute = RouteProp<RootStackParamList, "ProviderDetail">;

const ProviderDetailScreen = () => {
  const route = useRoute<ProviderDetailRoute>();
  const { providerId, providerName } = route.params;

  const [provider, setProvider] = useState<ProviderViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProvider = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchProviderById(providerId);
      setProvider(payload);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load provider.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{provider?.name ?? providerName}</Text>
        <Text style={styles.subtitle}>Trusted professional profile</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Loading provider detail...</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Unable to load provider</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadProvider}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && provider ? (
        <>
          <View style={styles.infoCard}>
            <Row label="Provider ID" value={provider.id} />
            <Row label="Category" value={provider.category} />
            <Row label="City" value={provider.city} />
            <Row label="Rating" value={provider.rating.toFixed(1)} />
            <Row
              label="Availability"
              value={provider.isAvailableToday ? "Available today" : "No slots today"}
              highlight
            />
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Integration status</Text>
            <Text style={styles.noteBody}>
              Detail screen now consumes `/api/providers/{'{'}id{'}'}` via local API client and is
              ready for assignment workflow integration.
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
  title: {
    color: colors.surface,
    fontSize: fontSizes.xl,
    fontWeight: "800",
  },
  subtitle: {
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
    color: colors.brand,
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

export default ProviderDetailScreen;
