import React, { useCallback, useEffect, useState } from "react";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { fetchPropertyById, type PropertyViewModel } from "../api/propertyApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyDetailRoute = RouteProp<ManagerStackParamList, "PropertyDetail">;

const PropertyDetailScreen = () => {
  const route = useRoute<PropertyDetailRoute>();
  const { propertyId, propertyTitle } = route.params;

  const [property, setProperty] = useState<PropertyViewModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Integration status</Text>
            <Text style={styles.noteBody}>
              Detail screen is now wired to `/api/properties/{'{'}id{'}'}` through the local API
              client and prepared for manager actions.
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
