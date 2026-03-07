import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getSessionSnapshot, registerUnauthorizedResetHandler } from "../auth/session";
import AvailabilityShellScreen from "../screens/AvailabilityShellScreen";
import ProviderDashboardScreen from "../screens/ProviderDashboardScreen";
import ProviderDetailScreen from "../screens/ProviderDetailScreen";
import ProviderListScreen from "../screens/ProviderListScreen";
import RoleMismatchScreen from "../screens/RoleMismatchScreen";
import ProviderUnauthorizedScreen from "../screens/ProviderUnauthorizedScreen";

export type RootStackParamList = {
  ProviderDashboard: undefined;
  ProviderList: undefined;
  ProviderDetail: { providerId: string; providerName: string };
  AvailabilityShell: undefined;
  ProviderRoleMismatch: {
    expectedRole: "provider" | "manager" | "admin";
    actualRole: string;
    context: string;
  };
  ProviderUnauthorized: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const RootStack = () => {
  const initialRoute = getSessionSnapshot().hasToken ? "ProviderDashboard" : "ProviderUnauthorized";

  React.useEffect(() => {
    registerUnauthorizedResetHandler(() => {
      if (!navigationRef.isReady()) {
        return;
      }
      navigationRef.navigate("ProviderUnauthorized");
    });

    return () => {
      registerUnauthorizedResetHandler(null);
    };
  }, []);

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      <Stack.Screen
        name="ProviderDashboard"
        component={ProviderDashboardScreen}
        options={{ title: "Provider Dashboard" }}
      />
      <Stack.Screen
        name="AvailabilityShell"
        component={AvailabilityShellScreen}
        options={{ title: "Availability" }}
      />
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
      <Stack.Screen
        name="ProviderUnauthorized"
        component={ProviderUnauthorizedScreen}
        options={{ title: "Access Blocked", headerBackVisible: false }}
      />
      <Stack.Screen
        name="ProviderRoleMismatch"
        component={RoleMismatchScreen}
        options={{ title: "Role Mismatch", headerBackVisible: false }}
      />
    </Stack.Navigator>
  );
};

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack />
    </NavigationContainer>
  );
}
