import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getSessionSnapshot, registerUnauthorizedResetHandler } from "../auth/session";
import ManagerDashboardScreen from "../screens/ManagerDashboardScreen";
import ManagerToProviderHandoffScreen from "../screens/ManagerToProviderHandoffScreen";
import PropertyDetailScreen from "../screens/PropertyDetailScreen";
import PropertyEditorScreen from "../screens/PropertyEditorScreen";
import PropertyListScreen from "../screens/PropertyListScreen";
import RoleMismatchScreen from "../screens/RoleMismatchScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SessionExpiredScreen from "../screens/auth/SessionExpiredScreen";
import UnauthorizedScreen from "../screens/auth/UnauthorizedScreen";

export type ManagerStackParamList = {
  Login: undefined;
  ManagerDashboard: undefined;
  ManagerToProviderHandoff: {
    providerId?: string;
    propertyId?: string;
  };
  RoleMismatch: {
    expectedRole: "manager" | "provider" | "admin";
    actualRole: string;
    context: string;
  };
  PropertyList: undefined;
  PropertyDetail: { propertyId: string; propertyTitle: string };
  PropertyEditor:
    | { mode: "create" }
    | {
        mode: "edit";
        propertyId: string;
      };
  Unauthorized: undefined;
  SessionExpired: undefined;
};

const Stack = createNativeStackNavigator<ManagerStackParamList>();
const navigationRef = createNavigationContainerRef<ManagerStackParamList>();

const ManagerStack = () => {
  const initialRoute = getSessionSnapshot().hasToken ? "ManagerDashboard" : "Login";

  React.useEffect(() => {
    registerUnauthorizedResetHandler(() => {
      if (!navigationRef.isReady()) {
        return;
      }
      navigationRef.navigate("Unauthorized");
    });

    return () => {
      registerUnauthorizedResetHandler(null);
    };
  }, []);

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: "Manager Login", headerBackVisible: false }}
      />
      <Stack.Screen
        name="Unauthorized"
        component={UnauthorizedScreen}
        options={{ title: "Access Blocked", headerBackVisible: false }}
      />
      <Stack.Screen
        name="SessionExpired"
        component={SessionExpiredScreen}
        options={{ title: "Session Expired", headerBackVisible: false }}
      />
      <Stack.Screen
        name="ManagerDashboard"
        component={ManagerDashboardScreen}
        options={{ title: "Dashboard" }}
      />
      <Stack.Screen
        name="ManagerToProviderHandoff"
        component={ManagerToProviderHandoffScreen}
        options={{ title: "Provider Handoff" }}
      />
      <Stack.Screen
        name="RoleMismatch"
        component={RoleMismatchScreen}
        options={{ title: "Role Mismatch", headerBackVisible: false }}
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
      <Stack.Screen
        name="PropertyEditor"
        component={PropertyEditorScreen}
        options={{ title: "Property Editor" }}
      />
    </Stack.Navigator>
  );
};

export default function ManagerNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <ManagerStack />
    </NavigationContainer>
  );
}
