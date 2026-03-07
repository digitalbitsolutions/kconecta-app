import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { clearSession } from "../../auth/session";
import type { ManagerStackParamList } from "../../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../../theme/tokens";

type SessionExpiredNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "SessionExpired"
>;

const SessionExpiredScreen = () => {
  const navigation = useNavigation<SessionExpiredNavigation>();

  const onReauthenticate = () => {
    clearSession();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Session Expired</Text>
        <Text style={styles.body}>
          Your session has expired. Please log in again to continue using manager features.
        </Text>

        <Pressable style={styles.primaryAction} onPress={onReauthenticate}>
          <Text style={styles.primaryActionText}>Re-authenticate</Text>
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
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
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

export default SessionExpiredScreen;
