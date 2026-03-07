import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { borderRadius, colors, fontSizes, spacing } from '../theme/tokens';

const ProviderDashboardScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Provider Dashboard</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Provider Information</Text>
        <Text style={styles.cardText}>View and manage your provider profile</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Availability</Text>
        <Text style={styles.cardText}>Set your availability slots</Text>
        <Text style={styles.cardAction} onPress={() => navigation.navigate('ProviderList')}>
          Manage slots
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSizes.md,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  cardAction: {
    fontSize: fontSizes.sm,
    color: colors.brand,
    textDecorationLine: 'underline',
  },
});

export default ProviderDashboardScreen;
