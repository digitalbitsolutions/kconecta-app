import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

export type PropertySummary = {
  id: string;
  title: string;
  city: string;
  status: "available" | "reserved" | "maintenance";
  price: string;
  managerId?: string;
};

type PropertyListItemProps = {
  property: PropertySummary;
  onPress: () => void;
};

const PropertyListItem: React.FC<PropertyListItemProps> = ({ property, onPress }) => {
  const statusStyle = (() => {
    if (property.status === "available") {
      return styles.statusAvailable;
    }
    if (property.status === "reserved") {
      return styles.statusReserved;
    }
    return styles.statusMaintenance;
  })();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{property.title}</Text>
        <Text style={[styles.status, statusStyle]}>{property.status}</Text>
      </View>
      <Text style={styles.city}>{property.city}</Text>
      {property.managerId ? <Text style={styles.manager}>Manager: {property.managerId}</Text> : null}
      <Text style={styles.price}>{property.price}</Text>
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
  },
  pressed: {
    opacity: 0.92,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    maxWidth: "76%",
  },
  city: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  manager: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  price: {
    color: colors.accent,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  status: {
    borderRadius: borderRadius.full,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  statusAvailable: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  statusReserved: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  statusMaintenance: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
});

export default PropertyListItem;
