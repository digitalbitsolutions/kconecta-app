import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
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
import { setManagerAssignmentSelectionResult } from "../api/propertyApi";
import {
  fetchManagerProviderDirectory,
  type ProviderDirectoryFilters,
  type ProviderDirectoryItem,
  type ProviderStatusFilter,
} from "../api/providerApi";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type ProviderDirectoryNavigation = NativeStackNavigationProp<
  ManagerStackParamList,
  "ProviderDirectory"
>;
type ProviderDirectoryRoute = RouteProp<ManagerStackParamList, "ProviderDirectory">;

const STATUS_FILTERS: Array<{ label: string; value: ProviderStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

const PAGE_SIZE = 12;

const ManagerProviderDirectoryScreen = () => {
  const navigation = useNavigation<ProviderDirectoryNavigation>();
  const route = useRoute<ProviderDirectoryRoute>();
  const selectionContext = route.params?.selectionContext;
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProviderStatusFilter>("all");
  const [items, setItems] = useState<ProviderDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    source: "database" as "database" | "in_memory",
  });

  const normalizedSearch = useMemo(() => search.trim(), [search]);
  const normalizedCity = useMemo(() => city.trim(), [city]);
  const normalizedCategory = useMemo(() => category.trim(), [category]);
  const hasFilters =
    normalizedSearch.length > 0 ||
    normalizedCity.length > 0 ||
    normalizedCategory.length > 0 ||
    statusFilter !== "all";

  const handleAuthError = useCallback(
    (requestError: unknown): boolean => {
      if (!(requestError instanceof ApiError)) {
        return false;
      }
      if (requestError.status === 401) {
        navigation.reset({ index: 0, routes: [{ name: "SessionExpired" }] });
        return true;
      }
      if (requestError.status === 403) {
        navigation.reset({ index: 0, routes: [{ name: "Unauthorized" }] });
        return true;
      }
      return false;
    },
    [navigation]
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean, override?: ProviderDirectoryFilters) => {
      const filters: ProviderDirectoryFilters = {
        status: override?.status ?? statusFilter,
        category: override?.category ?? normalizedCategory,
        city: override?.city ?? normalizedCity,
        search: override?.search ?? normalizedSearch,
        page,
        perPage: PAGE_SIZE,
      };

      try {
        const payload = await fetchManagerProviderDirectory(filters);
        setItems((current) => (append ? [...current, ...payload.items] : payload.items));
        setMeta({
          page: payload.meta.page,
          total: payload.meta.total,
          totalPages: payload.meta.totalPages,
          hasNextPage: payload.meta.hasNextPage,
          source: payload.meta.source,
        });
        setError(null);
      } catch (requestError) {
        if (handleAuthError(requestError)) {
          return;
        }
        const message =
          requestError instanceof Error ? requestError.message : "Unable to load providers.";
        setError(message);
        if (!append) {
          setItems([]);
          setMeta((current) => ({
            ...current,
            page: 1,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
          }));
        }
      }
    },
    [handleAuthError, normalizedCategory, normalizedCity, normalizedSearch, statusFilter]
  );

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    await fetchPage(1, false);
    setLoading(false);
  }, [fetchPage]);

  const loadNextPage = useCallback(async () => {
    if (loading || loadingMore || !meta.hasNextPage) {
      return;
    }
    setLoadingMore(true);
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

  const renderProvider = ({ item }: { item: ProviderDirectoryItem }) => (
    <Pressable
      style={styles.providerCard}
      onPress={
        selectionContext
          ? undefined
          : () =>
              navigation.navigate("ProviderProfile", {
                providerId: item.id,
                providerName: item.name,
              })
      }
    >
      <View style={styles.providerCardHeader}>
        <View style={styles.providerCardTitleWrap}>
          <Text style={styles.providerName}>{item.name}</Text>
          <Text style={styles.providerMeta}>
            {item.category} | {item.city}
          </Text>
        </View>
        <View style={[styles.statusBadge, item.status === "active" ? styles.statusActive : styles.statusInactive]}>
          <Text style={styles.statusBadgeText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.providerDetail}>Rating: {item.rating}</Text>
      <Text style={styles.providerDetail}>{item.availabilitySummary.label}</Text>
      {item.availabilitySummary.nextOpenSlot ? (
        <Text style={styles.providerDetail}>
          Next slot: {item.availabilitySummary.nextOpenSlot}
        </Text>
      ) : null}
      <Text style={styles.providerServices}>
        Services: {item.servicesPreview.length > 0 ? item.servicesPreview.join(", ") : "n/a"}
      </Text>
      {selectionContext ? (
        <>
          <Pressable
            style={[
              styles.primarySelectionAction,
              selectionContext.currentProviderId === item.id && styles.selectionActionMuted,
            ]}
            disabled={selectionContext.currentProviderId === item.id}
            onPress={() => {
              setManagerAssignmentSelectionResult({
                queueItemId: selectionContext.queueItemId,
                providerId: item.id,
                providerName: item.name,
              });
              navigation.goBack();
            }}
          >
            <Text style={styles.primarySelectionActionText}>
              {selectionContext.currentProviderId === item.id
                ? "Already assigned"
                : `Select ${item.name}`}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryProfileAction}
            onPress={() =>
              navigation.navigate("ProviderProfile", {
                providerId: item.id,
                providerName: item.name,
              })
            }
          >
            <Text style={styles.viewProfileText}>Review provider profile</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.viewProfileText}>Open provider profile</Text>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Provider Directory</Text>
      <Text style={styles.subtitle}>
        Review providers, availability signal and profile detail before assigning work.
      </Text>

      {selectionContext ? (
        <View style={styles.selectionBanner}>
          <Text style={styles.selectionBannerTitle}>Reassign provider</Text>
          <Text style={styles.selectionBannerBody}>
            Select a provider for {selectionContext.propertyTitle}. The chosen provider will be
            applied when you return to assignment detail.
          </Text>
        </View>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, service or city"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="Filter by city"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder="Filter by category"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <View style={styles.statusRow}>
        {STATUS_FILTERS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.statusChip,
              statusFilter === option.value ? styles.statusChipActive : styles.statusChipInactive,
            ]}
            onPress={() => setStatusFilter(option.value)}
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

      {hasFilters ? (
        <Pressable
          style={styles.clearFiltersButton}
          onPress={() => {
            setSearch("");
            setCity("");
            setCategory("");
            setStatusFilter("all");
          }}
        >
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      ) : null}

      {!loading && !error ? (
        <Text style={styles.metaText}>
          Page {meta.page}/{Math.max(meta.totalPages, 1)} | Showing {items.length} of {meta.total} ({meta.source})
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.loadingText}>Loading provider directory...</Text>
        </View>
      ) : null}

      {!loading && error && items.length === 0 ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>Unable to load provider directory</Text>
          <Text style={styles.feedbackBody}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadFirstPage()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>No providers found</Text>
          <Text style={styles.feedbackBody}>
            Adjust city, category or status filters to review a different provider slice.
          </Text>
        </View>
      ) : null}

      {!loading && items.length > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderProvider}
          onEndReached={() => void loadNextPage()}
          onEndReachedThreshold={0.35}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.brand} />
                <Text style={styles.loadingText}>Loading next page...</Text>
              </View>
            ) : null
          }
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
  selectionBanner: {
    backgroundColor: colors.surface,
    borderColor: colors.brand,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  selectionBannerTitle: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  selectionBannerBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
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
    marginTop: spacing.sm,
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
    marginTop: spacing.sm,
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
  feedbackCard: {
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  feedbackBody: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    lineHeight: 22,
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
  list: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xxl,
  },
  providerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  providerCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  providerCardTitleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  providerName: {
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: "700",
  },
  providerMeta: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusActive: {
    backgroundColor: colors.accent,
  },
  statusInactive: {
    backgroundColor: colors.textMuted,
  },
  statusBadgeText: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  providerDetail: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  providerServices: {
    color: colors.textPrimary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  primarySelectionAction: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  primarySelectionActionText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  secondaryProfileAction: {
    marginTop: spacing.sm,
  },
  selectionActionMuted: {
    opacity: 0.6,
  },
  viewProfileText: {
    color: colors.brand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});

export default ManagerProviderDirectoryScreen;
