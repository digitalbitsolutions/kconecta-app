import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProviderListScreen from "../screens/ProviderListScreen";
import ProviderDetailScreen from "../screens/ProviderDetailScreen";

export type RootStackParamList = {
  ProviderList: undefined;
  ProviderDetail: { providerId: string; providerName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootStack = () => (
  <Stack.Navigator initialRouteName="ProviderList">
    <Stack.Screen
      name="ProviderList"
      component={ProviderListScreen}
      options={{ title: "Providers" }}
    />
    <Stack.Screen
      name="ProviderDetail"
      component={ProviderDetailScreen}
      options={{ title: "Provider Details" }}
    />
  </Stack.Navigator>
);

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}
