import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
import { ApiError } from "../api/client";
import { fetchPropertyPortfolio, type PropertyViewModel } from "../api/propertyApi";
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
  const [total, setTotal] = useState<number>(0);
  const [source, setSource] = useState<"database" | "in_memory" | "unknown">("unknown");

  const normalizedSearch = useMemo(() => search.trim(), [search]);

  const loadProperties = useCallback(
    async (searchTerm: string) => {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchPropertyPortfolio({
          search: searchTerm || undefined,
          page: 1,
          perPage: 50,
        });

        setProperties(payload.properties);
        setTotal(payload.meta.total);
        setSource(payload.meta.source);
      } catch (fetchError) {
        if (fetchError instanceof ApiError) {
          if (fetchError.status === 401) {
            navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
            return;
          }
          if (fetchError.status === 403) {
            navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
            return;
          }
        }

        const message = fetchError instanceof Error ? fetchError.message : "Unable to load properties.";
        setError(message);
        setProperties([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [navigation]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProperties(normalizedSearch);
    }, 250);

    return () => clearTimeout(timer);
  }, [normalizedSearch, loadProperties]);

  useFocusEffect(
    useCallback(() => {
      loadProperties(normalizedSearch);
      return undefined;
    }, [loadProperties, normalizedSearch])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Property Portfolio</Text>
      <Text style={styles.subtitle}>Monitor status, pricing and city distribution.</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title, city, manager or status"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />

      {!loading && !error ? (
        <Text style={styles.metaText}>Showing {properties.length} of {total} properties ({source})</Text>
      ) : null}

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
          <Pressable style={styles.retryButton} onPress={() => loadProperties(normalizedSearch)}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && properties.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No properties found</Text>
          <Text style={styles.emptyBody}>Try another keyword or clear the search.</Text>
        </View>
      ) : null}

      {!loading && !error && properties.length > 0 ? (
        <FlatList
          data={properties}
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
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    marginBottom: spacing.sm,
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
