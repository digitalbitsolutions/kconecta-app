import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "../navigation";

type ProviderListNavigation = NativeStackNavigationProp<RootStackParamList, "ProviderList">;

type ProviderSummary = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
};

const mockProviders: ProviderSummary[] = [
  { id: "prov-001", name: "CleanHome Pro", category: "Cleaning", city: "Madrid", rating: 4.8 },
  { id: "prov-002", name: "FixIt Now", category: "Repairs", city: "Barcelona", rating: 4.5 },
  { id: "prov-003", name: "GreenGarden", category: "Gardening", city: "Valencia", rating: 4.7 },
];

const fetchProviders = async (): Promise<ProviderSummary[]> => {
  // Placeholder for API client integration.
  return Promise.resolve(mockProviders);
};

const ProviderListScreen = () => {
  const navigation = useNavigation<ProviderListNavigation>();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);

  useEffect(() => {
    fetchProviders().then(setProviders);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate("ProviderDetail", {
                providerId: item.id,
                providerName: item.name,
              })
            }
            style={styles.card}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.category}</Text>
            <Text style={styles.meta}>{item.city}</Text>
            <Text style={styles.meta}>Rating: {item.rating}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No providers found.</Text>}
      />
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
    marginBottom: 12,
    padding: 16,
  },
  name: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  meta: {
    color: "#4B5563",
    fontSize: 14,
  },
  empty: {
    color: "#6B7280",
    fontSize: 14,
    marginTop: 24,
    textAlign: "center",
  },
});

export default ProviderListScreen;
