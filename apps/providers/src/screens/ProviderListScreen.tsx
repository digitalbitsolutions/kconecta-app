import React, { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ProviderCard, { type ProviderSummary } from "../components/ProviderCard";
import type { RootStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type ProviderListNavigation = NativeStackNavigationProp<RootStackParamList, "ProviderList">;

const mockProviders: ProviderSummary[] = [
  {
    id: "prov-001",
    name: "CleanHome Pro",
    category: "Cleaning",
    city: "Madrid",
    rating: 4.8,
    isAvailableToday: true,
  },
  {
    id: "prov-002",
    name: "FixIt Now",
    category: "Repairs",
    city: "Barcelona",
    rating: 4.5,
    isAvailableToday: false,
  },
  {
    id: "prov-003",
    name: "GreenGarden",
    category: "Gardening",
    city: "Valencia",
    rating: 4.7,
    isAvailableToday: true,
  },
];

const fetchProviders = async (): Promise<ProviderSummary[]> => {
  // API client placeholder
  return Promise.resolve(mockProviders);
};

const ProviderListScreen = () => {
  const navigation = useNavigation<ProviderListNavigation>();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviders().then((items) => {
      setProviders(items);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return providers;
    }
    return providers.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.city.toLowerCase().includes(term)
      );
    });
  }, [providers, search]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Loading providers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Providers</Text>
        <Text style={styles.subtitle}>Find verified professionals for home services.</Text>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, category or city"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No providers found</Text>
          <Text style={styles.emptyBody}>Try another search term or remove filters.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProviderCard
              provider={item}
              onPress={() =>
                navigation.navigate("ProviderDetail", {
                  providerId: item.id,
                  providerName: item.name,
                })
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
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
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  loadingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    marginTop: spacing.md,
  },
  emptyWrap: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.lg,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});

export default ProviderListScreen;
