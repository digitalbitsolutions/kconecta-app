import React from "react";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyDetailRoute = RouteProp<ManagerStackParamList, "PropertyDetail">;

const PropertyDetailScreen = () => {
  const route = useRoute<PropertyDetailRoute>();
  const { propertyId, propertyTitle } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{propertyTitle}</Text>
        <Text style={styles.heroSubtitle}>Property operational snapshot</Text>
      </View>

      <View style={styles.infoCard}>
        <Row label="Property ID" value={propertyId} />
        <Row label="City" value="Madrid" />
        <Row label="Status" value="available" highlight />
        <Row label="Price" value="EUR 235,000" />
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Integration note</Text>
        <Text style={styles.noteBody}>
          This detail view is prepared for backend integration with `/api/properties/{id}` and
          manager actions such as reserve, update and assign provider.
        </Text>
      </View>
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
