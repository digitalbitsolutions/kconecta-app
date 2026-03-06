import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { borderRadius, colors, fontSizes, shadows, spacing } from "../theme/tokens";

export type ProviderSummary = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
  isAvailableToday?: boolean;
};

type ProviderCardProps = {
  provider: ProviderSummary;
  onPress: () => void;
};

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onPress }) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{provider.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{provider.rating.toFixed(1)}</Text>
        </View>
      </View>

      <Text style={styles.meta}>{provider.category}</Text>
      <Text style={styles.meta}>{provider.city}</Text>

      <Text style={[styles.availability, provider.isAvailableToday ? styles.available : styles.unavailable]}>
        {provider.isAvailableToday ? "Available today" : "No slots today"}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  name: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    maxWidth: "85%",
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: borderRadius.full,
    minWidth: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  meta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  availability: {
    fontSize: fontSizes.sm,
    fontWeight: "600",
    marginTop: spacing.md,
  },
  available: {
    color: colors.brand,
  },
  unavailable: {
    color: colors.danger,
  },
});

export default ProviderCard;
