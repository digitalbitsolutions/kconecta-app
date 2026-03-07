import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProviderListScreen from '../screens/ProviderListScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';
import ProviderDashboardScreen from '../screens/ProviderDashboardScreen';

export type RootStackParamList = {
  ProviderList: undefined;
  ProviderDetail: { providerId: string; providerName: string };
  ProviderDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootStack = () => (
  <Stack.Navigator initialRouteName="ProviderDashboard">
    <Stack.Screen
      name="ProviderDashboard"
      component={ProviderDashboardScreen}
      options={{ title: 'Dashboard' }}
    />
    <Stack.Screen
      name="ProviderList"
      component={ProviderListScreen}
      options={{ title: 'Providers' }}
    />
    <Stack.Screen
      name="ProviderDetail"
      component={ProviderDetailScreen}
      options={{ title: 'Provider Details' }}<｜begin▁of▁sentence｜>