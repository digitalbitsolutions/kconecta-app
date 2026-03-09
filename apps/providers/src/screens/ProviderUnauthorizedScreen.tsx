import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { clearSession } from "../auth/session";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type UnauthorizedNavigation = NativeStackNavigationProp<
  RootStackParamList,
  "ProviderUnauthorized"
>;

const ProviderUnauthorizedScreen = () => {
  const navigation = useNavigation<UnauthorizedNavigation>();

  const onRecover = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "ProviderLogin" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Authorization Required</Text>
        <Text style={styles.body}>
          Your session cannot access provider workflows. Recover session to continue.
        </Text>

        <Pressable style={styles.primaryAction} onPress={onRecover}>
          <Text style={styles.primaryActionText}>Go To Login</Text>
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
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});

export default ProviderUnauthorizedScreen;
