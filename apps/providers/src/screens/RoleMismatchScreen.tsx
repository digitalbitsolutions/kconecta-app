import React from "react";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { clearSession } from "../auth/session";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type RoleMismatchRoute = RouteProp<RootStackParamList, "ProviderRoleMismatch">;
type RoleMismatchNavigation = NativeStackNavigationProp<RootStackParamList, "ProviderRoleMismatch">;

const RoleMismatchScreen = () => {
  const route = useRoute<RoleMismatchRoute>();
  const navigation = useNavigation<RoleMismatchNavigation>();
  const { expectedRole, actualRole, context } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Role Mismatch</Text>
        <Text style={styles.body}>
          This provider flow requires a different role context. Recover session to continue.
        </Text>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Expected Role</Text>
          <Text style={styles.metaValue}>{expectedRole}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Actual Role</Text>
          <Text style={styles.metaValue}>{actualRole}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Context</Text>
          <Text style={styles.metaValue}>{context}</Text>
        </View>

        <Pressable
          style={styles.primaryAction}
          onPress={() => {
            clearSession();
            navigation.reset({
              index: 0,
              routes: [{ name: "ProviderUnauthorized" }],
            });
          }}
        >
          <Text style={styles.primaryActionText}>Recover Session</Text>
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
});

export default RoleMismatchScreen;
