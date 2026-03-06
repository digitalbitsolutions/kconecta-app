import React, { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { RootStackParamList } from '../navigation';
import ProviderCard from '../components/ProviderCard';

type ProviderListNavigation = NativeStackNavigationProp<RootStackParamList, 'ProviderList'>;

type ProviderSummary = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating: number;
};

const mockProviders: ProviderSummary[] = [
  // ...
];

const fetchProviders = async (): Promise<ProviderSummary[]> => {
  // Placeholder for API client integration.
  return Promise.resolve(mockProviders);
};

const ProviderListScreen = () => {
  const navigation = useNavigation<ProviderListNavigation>();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviders().then((providers) => {
      setProviders(providers);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!providers.length) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>No providers found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProviderCard
            provider={item}
            onPress={() =>
              navigation.navigate('ProviderDetail', {
                providerId: item.id,
                providerName: item.name,
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    padding: 16,
  },
});

export default ProviderListScreen;
