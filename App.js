// App.js
import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons, Feather, Ionicons } from "@expo/vector-icons"; // <-- Updated icons
import WelcomeScreen from "./screens/WelcomeScreen";
import SignupScreen from "./screens/SignupScreen";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ExpensesScreen from "./screens/ExpensesScreen";
import BudgetScreen from "./screens/BudgetScreen";
import SettingsScreen from "./screens/SettingsScreen";
import CategoryDetailScreen from "./screens/CategoryDetailScreen";
import CategoryCollaborationScreen from "./screens/CategoryCollaborationScreen";
import CategoryGoalsScreen from "./screens/CategoryGoalsScreen";
import SavingsScreen from "./screens/SavingsScreen";
import SharedGoalsScreen from "./screens/SharedGoalsScreen";
import SharedBudgetsScreen from "./screens/SharedBudgetsScreen";

// Create global context (for theme, currency, user, etc.)
import { AppContext } from "./AppContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// MainTabs will be rendered inside App so it receives appContextValue via props
function MainTabs({ appContext }) {
  const isDark = appContext.theme === "dark";
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "#1f2937" : "#fff",
          borderTopWidth: 0.5,
          borderTopColor: isDark ? "#374151" : "#ccc",
          paddingBottom: 5,
          height: 60,
        },
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case "Dashboard":
              return <MaterialIcons name="account-balance-wallet" size={size} color={color} />;
            case "Expenses":
              return <Feather name="trending-up" size={size} color={color} />;
            case "Goals":
              return <MaterialIcons name="flag" size={size} color={color} />;
            case "Settings":
              return <Ionicons name="settings-outline" size={size} color={color} />;
            default:
              return null;
          }
        },
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: isDark ? "#9ca3af" : "#888",
      })}
    >
      <Tab.Screen name="Dashboard">
        {(props) => <DashboardScreen {...props} appContext={appContext} />}
      </Tab.Screen>
      <Tab.Screen name="Expenses">
        {(props) => <ExpensesScreen {...props} appContext={appContext} />}
      </Tab.Screen>
      <Tab.Screen name="Goals">
        {(props) => <BudgetScreen {...props} appContext={appContext} />}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {(props) => <SettingsScreen {...props} appContext={appContext} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [theme, setTheme] = useState("light");
  const [currency, setCurrency] = useState("PHP");
  const [currentUser, setCurrentUser] = useState(null);

  const appContextValue = {
    theme,
    setTheme,
    currency,
    setCurrency,
    currentUser,
    setCurrentUser,
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome">
          {(props) => <WelcomeScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="Signup">
          {(props) => <SignupScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="Login">
          {(props) => <LoginScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="MainTabs">
          {(props) => <MainTabs {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="CategoryDetail" options={{ headerShown: false }}>
          {(props) => <CategoryDetailScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="CategoryCollaboration" options={{ headerShown: false }}>
          {(props) => <CategoryCollaborationScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="SharedGoals" options={{ headerShown: false }}>
          {(props) => <SharedGoalsScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="SharedBudgets" options={{ headerShown: false }}>
          {(props) => <SharedBudgetsScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="CategoryGoals" options={{ headerShown: false }}>
          {(props) => <CategoryGoalsScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
        <Stack.Screen name="Savings" options={{ headerShown: false }}>
          {(props) => <SavingsScreen {...props} appContext={appContextValue} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
