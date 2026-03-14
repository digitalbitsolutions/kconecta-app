import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import {
  registerUnauthorizedResetHandler,
  resolveManagerBootstrapState,
  type SessionBootstrapResult,
} from "../auth/session";
import ManagerAssignmentCenterScreen from "../screens/ManagerAssignmentCenterScreen";
import ManagerAssignmentDetailScreen from "../screens/ManagerAssignmentDetailScreen";
import ManagerDashboardScreen from "../screens/ManagerDashboardScreen";
import ManagerProviderDirectoryScreen from "../screens/ManagerProviderDirectoryScreen";
import ManagerToProviderHandoffScreen from "../screens/ManagerToProviderHandoffScreen";
import PropertyDetailScreen from "../screens/PropertyDetailScreen";
import PropertyEditorScreen from "../screens/PropertyEditorScreen";
import PropertyListScreen from "../screens/PropertyListScreen";
import ProviderProfileScreen from "../screens/ProviderProfileScreen";
import RoleMismatchScreen from "../screens/RoleMismatchScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import SessionExpiredScreen from "../screens/auth/SessionExpiredScreen";
import UnauthorizedScreen from "../screens/auth/UnauthorizedScreen";
import { colors, fontSizes, spacing } from "../theme/tokens";

export type ManagerStackParamList = {
  Bootstrap: undefined;
  Login: undefined;
  ManagerDashboard: undefined;
  ManagerAssignmentCenter: undefined;
  ManagerAssignmentDetail: {
    queueItemId: string;
  };
  ProviderDirectory: undefined;
  ProviderProfile: {
    providerId: string;
    providerName?: string;
  };
  ManagerToProviderHandoff: {
    propertyId: string;
    propertyTitle?: string;
    preselectedProviderId?: string;
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

const bootstrapRoutes: Record<SessionBootstrapResult, keyof ManagerStackParamList> = {
  authorized: "ManagerDashboard",
  login_required: "Login",
  unauthorized: "Unauthorized",
  session_expired: "SessionExpired",
};

const BootstrapScreen = () => {
  const [statusText, setStatusText] = React.useState("Checking session...");

  React.useEffect(() => {
    let cancelled = false;

    const resolveRoute = async () => {
      setStatusText("Validating manager session...");
      const result = await resolveManagerBootstrapState();

      if (cancelled) {
        return;
      }

      const nextRoute = bootstrapRoutes[result] ?? "Login";
      navigationRef.reset({
        index: 0,
        routes: [{ name: nextRoute }],
      });
    };

    resolveRoute().catch(() => {
      if (cancelled) {
        return;
      }
      navigationRef.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.bootstrapContainer}>
      <View style={styles.bootstrapContent}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.bootstrapText}>{statusText}</Text>
      </View>
    </SafeAreaView>
  );
};

const ManagerStack = () => {
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
    <Stack.Navigator initialRouteName="Bootstrap">
      <Stack.Screen
        name="Bootstrap"
        component={BootstrapScreen}
        options={{ title: "Starting", headerShown: false }}
      />
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
        name="ManagerAssignmentCenter"
        component={ManagerAssignmentCenterScreen}
        options={{ title: "Assignment Center" }}
      />
      <Stack.Screen
        name="ManagerAssignmentDetail"
        component={ManagerAssignmentDetailScreen}
        options={{ title: "Assignment Detail" }}
      />
      <Stack.Screen
        name="ProviderDirectory"
        component={ManagerProviderDirectoryScreen}
        options={{ title: "Provider Directory" }}
      />
      <Stack.Screen
        name="ProviderProfile"
        component={ProviderProfileScreen}
        options={{ title: "Provider Profile" }}
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

const styles = StyleSheet.create({
  bootstrapContainer: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  bootstrapContent: {
    alignItems: "center",
  },
  bootstrapText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
});
