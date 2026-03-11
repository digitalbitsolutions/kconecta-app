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
import { fetchPropertyPortfolio, type PropertyStatus, type PropertyViewModel } from "../api/propertyApi";
import PropertyListItem from "../components/PropertyListItem";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyListNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyList">;
type StatusFilter = "all" | PropertyStatus;

const STATUS_FILTERS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Reserved", value: "reserved" },
  { label: "Maintenance", value: "maintenance" },
];
const PAGE_SIZE = 10;

const PropertyListScreen = () => {
  const navigation = useNavigation<PropertyListNavigation>();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [properties, setProperties] = useState<PropertyViewModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    totalPages: 0,
    hasNextPage: false,
    source: "unknown" as "database" | "in_memory" | "unknown",
  });

  const normalizedSearch = useMemo(() => search.trim(), [search]);
  const normalizedCity = useMemo(() => city.trim(), [city]);
  const hasActiveFilters = normalizedSearch.length > 0 || normalizedCity.length > 0 || statusFilter !== "all";

  const handleAuthError = useCallback(
    (fetchError: unknown): boolean => {
      if (!(fetchError instanceof ApiError)) {
        return false;
      }
      if (fetchError.status === 401) {
        navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
        return true;
      }
      if (fetchError.status === 403) {
        navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
        return true;
      }
      return false;
    },
    [navigation]
  );

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean): Promise<void> => {
      try {
        const payload = await fetchPropertyPortfolio({
          status: statusFilter === "all" ? undefined : statusFilter,
          city: normalizedCity || undefined,
          search: normalizedSearch || undefined,
          page: nextPage,
          perPage: PAGE_SIZE,
        });

        setProperties((current) =>
          append ? [...current, ...payload.properties] : payload.properties
        );
        setMeta({
          total: payload.meta.total,
          page: payload.meta.page,
          totalPages: payload.meta.totalPages,
          hasNextPage: payload.meta.hasNextPage,
          source: payload.meta.source,
        });
      } catch (fetchError) {
        if (handleAuthError(fetchError)) {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Unable to load properties.";
        setError(message);
        if (!append) {
          setProperties([]);
          setMeta((current) => ({
            ...current,
            total: 0,
            page: 1,
            totalPages: 0,
            hasNextPage: false,
          }));
        }
      }
    },
    [handleAuthError, normalizedCity, normalizedSearch, statusFilter]
  );

  const loadFirstPage = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    await fetchPage(1, false);
    setLoading(false);
  }, [fetchPage]);

  const loadNextPage = useCallback(async (): Promise<void> => {
    if (loading || loadingMore || !meta.hasNextPage) {
      return;
    }

    setLoadingMore(true);
    setError(null);
    await fetchPage(meta.page + 1, true);
    setLoadingMore(false);
  }, [fetchPage, loading, loadingMore, meta.hasNextPage, meta.page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFirstPage();
    }, 280);

    return () => clearTimeout(timer);
  }, [loadFirstPage]);

  useFocusEffect(
    useCallback(() => {
      void loadFirstPage();
      return undefined;
    }, [loadFirstPage])
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Property Portfolio</Text>
      <Text style={styles.subtitle}>Monitor status, pricing and city distribution.</Text>

      <Pressable
        style={styles.createButton}
        onPress={() => navigation.navigate("PropertyEditor", { mode: "create" })}
      >
        <Text style={styles.createButtonText}>Create Property</Text>
      </Pressable>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title, manager or status"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="Filter by city"
        placeholderTextColor={colors.textMuted}
        style={styles.city}
      />

      <View style={styles.statusRow}>
        {STATUS_FILTERS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setStatusFilter(option.value)}
            style={[
              styles.statusChip,
              statusFilter === option.value ? styles.statusChipActive : styles.statusChipInactive,
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                statusFilter === option.value ? styles.statusChipTextActive : styles.statusChipTextInactive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {hasActiveFilters ? (
        <Pressable
          style={styles.clearFiltersButton}
          onPress={() => {
            setSearch("");
            setCity("");
            setStatusFilter("all");
          }}
        >
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      ) : null}

      {!loading && !error ? (
        <Text style={styles.metaText}>
          Page {meta.page}/{Math.max(meta.totalPages, 1)} • Showing {properties.length} of {meta.total} ({meta.source})
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
        </View>
      ) : null}

      {!loading && error && properties.length === 0 ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Unable to load properties</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadFirstPage()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && properties.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No properties found</Text>
          <Text style={styles.emptyBody}>Try another keyword, city or status filter.</Text>
        </View>
      ) : null}

      {!loading && properties.length > 0 ? (
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
          onEndReached={() => void loadNextPage()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.brand} />
                <Text style={styles.loadingText}>Loading next page...</Text>
              </View>
            ) : null
          }
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
  createButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  createButtonText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
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
  city: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  statusChipInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  statusChipText: {
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusChipTextActive: {
    color: colors.surface,
  },
  statusChipTextInactive: {
    color: colors.textSecondary,
  },
  clearFiltersButton: {
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  clearFiltersText: {
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
    fontWeight: "600",
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
  footerLoader: {
    alignItems: "center",
    paddingVertical: spacing.md,
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
    textAlign: "center",
  },
});

export default PropertyListScreen;
