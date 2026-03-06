import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes, borderRadius } from '../theme/tokens';

type ProviderSummary = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
};

type ProviderCardProps = {
  provider: ProviderSummary;
  onPress: () => void;
};

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onPress }) => (
  <View style={styles.card} onPress={onPress}>
    <Text style={styles.name}>{provider.name}</Text>
    <Text style={styles.meta}>{provider.category}</Text>
    <Text style={styles.meta}>{provider.city}</Text>
    <Text style={styles.meta}>Rating: {provider.rating}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.medium,
    padding: spacing.medium,
  },
  name: {
    color: colors.primary,
    fontSize: fontSizes.large,
    fontWeight: '600',
    marginBottom: spacing.small,
  },
  meta: {
    color: colors.tertiary,
    fontSize: fontSizes.medium,
  },
});

export default ProviderCard;
