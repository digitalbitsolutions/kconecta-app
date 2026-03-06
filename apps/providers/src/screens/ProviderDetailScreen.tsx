import React from "react";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type ProviderDetailRoute = RouteProp<RootStackParamList, "ProviderDetail">;

const ProviderDetailScreen = () => {
  const route = useRoute<ProviderDetailRoute>();
  const { providerId, providerName } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{providerName}</Text>
        <Text style={styles.subtitle}>Trusted professional profile</Text>
      </View>

      <View style={styles.infoCard}>
        <Row label="Provider ID" value={providerId} />
        <Row label="Category" value="Cleaning" />
        <Row label="City" value="Madrid" />
        <Row label="Availability" value="Available today" highlight />
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>Integration note</Text>
        <Text style={styles.noteBody}>
          This screen is connected to a placeholder contract. Next step is wiring live backend data
          from `/api/providers/:id`.
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
