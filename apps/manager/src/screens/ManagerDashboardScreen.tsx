import React from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import KpiCard from "../components/KpiCard";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type DashboardNavigation = NativeStackNavigationProp<ManagerStackParamList, "ManagerDashboard">;

const ManagerDashboardScreen = () => {
  const navigation = useNavigation<DashboardNavigation>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Manager Dashboard</Text>
        <Text style={styles.subtitle}>Track portfolio health and property operations.</Text>

        <View style={styles.kpiGrid}>
          <KpiCard label="Active Properties" value="84" helper="+6 this month" />
          <KpiCard label="Reserved" value="12" helper="14.2% conversion" />
          <KpiCard label="Avg. Time to Close" value="21d" helper="-3d vs last month" />
          <KpiCard label="Provider Matches" value="37" helper="8 pending actions" />
        </View>

        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate("PropertyList")}>
          <Text style={styles.primaryActionText}>Open Property Portfolio</Text>
        </Pressable>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today priorities</Text>
          <Text style={styles.sectionItem}>- Review 4 newly listed properties</Text>
          <Text style={styles.sectionItem}>- Confirm provider assignment for 3 requests</Text>
          <Text style={styles.sectionItem}>- Resolve 2 maintenance alerts</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.xl,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
  },
  primaryActionText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  sectionItem: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
});

export default ManagerDashboardScreen;

