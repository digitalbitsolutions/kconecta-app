import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ManagerDashboardScreen from "../screens/ManagerDashboardScreen";
import PropertyDetailScreen from "../screens/PropertyDetailScreen";
import PropertyListScreen from "../screens/PropertyListScreen";

export type ManagerStackParamList = {
  ManagerDashboard: undefined;
  PropertyList: undefined;
  PropertyDetail: { propertyId: string; propertyTitle: string };
};

const Stack = createNativeStackNavigator<ManagerStackParamList>();

const ManagerStack = () => {
  return (
    <Stack.Navigator initialRouteName="ManagerDashboard">
      <Stack.Screen
        name="ManagerDashboard"
        component={ManagerDashboardScreen}
        options={{ title: "Dashboard" }}
      />
      <Stack.Screen
        name="PropertyList"
        component={PropertyListScreen}
        options={{ title: "Properties" }}
      />
      <Stack.Screen
        name="PropertyDetail"
        component={PropertyDetailScreen}
        options={{ title: "Property Detail" }}
      />
    </Stack.Navigator>
  );
};

export default function ManagerNavigator() {
  return (
    <NavigationContainer>
      <ManagerStack />
    </NavigationContainer>
  );
}
