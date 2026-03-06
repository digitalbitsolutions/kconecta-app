import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchProperties, type PropertyViewModel } from "../api/propertyApi";
import PropertyListItem from "../components/PropertyListItem";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyListNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyList">;

const PropertyListScreen = () => {
  const navigation = useNavigation<PropertyListNavigation>();
  const [search, setSearch] = useState("");
  const [properties, setProperties] = useState<PropertyViewModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchProperties();
      setProperties(rows);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load properties.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return properties;
    }
    return properties.filter((property) => {
      return (
        property.title.toLowerCase().includes(term) ||
        property.city.toLowerCase().includes(term) ||
        property.status.toLowerCase().includes(term)
      );
    });
  }, [properties, search]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Property Portfolio</Text>
      <Text style={styles.subtitle}>Monitor status, pricing and city distribution.</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title, city or status"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Unable to load properties</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadProperties}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No properties found</Text>
          <Text style={styles.emptyBody}>Try another keyword or clear the search.</Text>
        </View>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PropertyListItem
              property={item}
              onPress={() =>
                navigation.navigate("PropertyDetail", {
                  propertyId: item.id,
                  propertyTitle: item.title,
                })
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
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
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  list: {
    paddingBottom: spacing.xxl,
  },
  loadingWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  errorWrap: {
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  errorBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
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
  },
});

export default PropertyListScreen;
