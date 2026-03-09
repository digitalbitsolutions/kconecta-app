import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getSessionIdentitySnapshot, registerUnauthorizedResetHandler } from "../auth/session";
import AvailabilityShellScreen from "../screens/AvailabilityShellScreen";
import ProviderDashboardScreen from "../screens/ProviderDashboardScreen";
import ProviderDetailScreen from "../screens/ProviderDetailScreen";
import RoleMismatchScreen from "../screens/RoleMismatchScreen";
import ProviderUnauthorizedScreen from "../screens/ProviderUnauthorizedScreen";
import ProviderLoginScreen from "../screens/auth/LoginScreen";

export type RootStackParamList = {
  ProviderLogin: undefined;
  ProviderDashboard: undefined;
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
  const session = getSessionIdentitySnapshot();
  const initialRoute = session.hasToken && session.providerId ? "ProviderDashboard" : "ProviderLogin";

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
        name="ProviderLogin"
        component={ProviderLoginScreen}
        options={{ title: "Provider Login", headerBackVisible: false }}
      />
      <Stack.Screen
        name="ProviderDashboard"
        component={ProviderDashboardScreen}
        options={{ title: "Provider Dashboard" }}
      />
      <Stack.Screen
        name="AvailabilityShell"
        component={AvailabilityShellScreen}
        options={{ title: "Availability Editor" }}
      />
      <Stack.Screen
        name="ProviderDetail"
        component={ProviderDetailScreen}
        options={{ title: "My Profile" }}
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
