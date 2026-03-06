import React, { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlatList, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import PropertyListItem, { type PropertySummary } from "../components/PropertyListItem";
import type { ManagerStackParamList } from "../navigation";
import { borderRadius, colors, fontSizes, spacing } from "../theme/tokens";

type PropertyListNavigation = NativeStackNavigationProp<ManagerStackParamList, "PropertyList">;

const mockProperties: PropertySummary[] = [
  {
    id: "prop-101",
    title: "Modern Loft Center",
    city: "Madrid",
    status: "available",
    price: "EUR 235,000",
  },
  {
    id: "prop-102",
    title: "Family Home North",
    city: "Barcelona",
    status: "reserved",
    price: "EUR 310,000",
  },
  {
    id: "prop-103",
    title: "City Apartment East",
    city: "Valencia",
    status: "maintenance",
    price: "EUR 198,000",
  },
];

const PropertyListScreen = () => {
  const navigation = useNavigation<PropertyListNavigation>();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return mockProperties;
    }
    return mockProperties.filter((property) => {
      return (
        property.title.toLowerCase().includes(term) ||
        property.city.toLowerCase().includes(term) ||
        property.status.toLowerCase().includes(term)
      );
    });
  }, [search]);

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

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No properties found</Text>
          <Text style={styles.emptyBody}>Try another keyword or clear the search.</Text>
        </View>
      ) : (
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
