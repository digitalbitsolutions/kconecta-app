import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import ProviderListScreen from '../screens/ProviderListScreen';
import ProviderDetailScreen from '../screens/ProviderDetailScreen';

export type RootStackParamList = {
  ProviderList: undefined;
  ProviderDetail: { providerId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

const RootStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProviderList" component={ProviderListScreen} />
      <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}
