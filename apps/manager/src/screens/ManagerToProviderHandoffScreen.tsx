import React from "react";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type HandoffRoute = RouteProp<ManagerStackParamList, "ManagerToProviderHandoff">;
type HandoffNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "ManagerToProviderHandoff"
>;

const ManagerToProviderHandoffScreen = () => {
  const route = useRoute<HandoffRoute>();
  const navigation = useNavigation<HandoffNavigation>();
  const providerId = route.params?.providerId ?? "unknown";
  const propertyId = route.params?.propertyId ?? "unknown";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Manager to Provider Handoff</Text>
        <Text style={styles.body}>
          This state validates cross-app context before provider workflows are opened.
        </Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Provider ID</Text>
          <Text style={styles.metaValue}>{providerId}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Property ID</Text>
          <Text style={styles.metaValue}>{propertyId}</Text>
        </View>

        <Pressable
          style={styles.primaryAction}
          onPress={() =>
            navigation.navigate("RoleMismatch", {
              expectedRole: "provider",
              actualRole: "manager",
              context: "manager_to_provider_handoff",
            })
          }
        >
          <Text style={styles.primaryActionText}>Simulate Role Mismatch</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("ManagerDashboard")}
        >
          <Text style={styles.secondaryActionText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
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
  metaBlock: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    textTransform: "uppercase",
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
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
    paddingVertical: spacing.md,
  },
  secondaryActionText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: "600",
  },
});

export default ManagerToProviderHandoffScreen;
