import React from "react";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation";

type ProviderDetailRoute = RouteProp<RootStackParamList, "ProviderDetail">;

const ProviderDetailScreen = () => {
  const route = useRoute<ProviderDetailRoute>();
  const { providerId, providerName } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{providerName}</Text>
        <Text style={styles.label}>Provider ID</Text>
        <Text style={styles.value}>{providerId}</Text>
        <Text style={styles.note}>
          API placeholder: fetch provider detail by ID from backend service.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FA",
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  label: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 2,
  },
  value: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  note: {
    color: "#4B5563",
    fontSize: 14,
  },
});

export default ProviderDetailScreen;
