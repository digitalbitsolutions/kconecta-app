import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type KpiCardProps = {
  label: string;
  value: string;
  helper?: string;
};

const KpiCard: React.FC<KpiCardProps> = ({ label, value, helper }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minHeight: 112,
    marginBottom: spacing.md,
    padding: spacing.lg,
    width: "48%",
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  value: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: "800",
    marginTop: spacing.sm,
  },
  helper: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
});

export default KpiCard;

