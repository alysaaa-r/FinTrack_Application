// screens/WelcomeScreen.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
// appContext will be provided via props from App.js

export default function WelcomeScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const isDark = theme === "dark";

  const features = [
    {
      icon: "pie-chart",
      title: "Smart Budgeting",
      description: "Track expenses and manage budgets effortlessly",
      color: "#3B82F6",
    },
    {
      icon: "people",
      title: "Collaborate & Share",
      description: "Share budgets with family or friends",
      color: "#10b981",
    },
    {
      icon: "trending-up",
      title: "Savings Goals",
      description: "Set and achieve your financial targets on your own",
      color: "#f59e0b",
    },
    {
      icon: "analytics",
      title: "Insights & Analytics",
      description: "Get detailed reports on your spending habits",
      color: "#8b5cf6",
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111827" : "#f9fafb" },
      ]}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <View style={styles.iconWrapper}>
              <MaterialIcons name="account-balance-wallet" color="#fff" size={36} />
            </View>
          </View>
          <Text style={[styles.title, { color: isDark ? "#fff" : "#111" }]}>
            FinTrack
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Your Personal Finance Companion
          </Text>
          <Text style={[styles.description, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
            Take control of your finances with smart budgeting, collaborative goals, and insightful analytics
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View
              key={index}
              style={[
                styles.featureCard,
                { backgroundColor: isDark ? "#1f2937" : "#fff" },
              ]}
            >
              <View style={[styles.featureIconWrapper, { backgroundColor: feature.color + "15" }]}>
                <Ionicons name={feature.icon} size={22} color={feature.color} />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: isDark ? "#fff" : "#111" }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("Signup")}
          >
            <Text style={styles.primaryText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: isDark ? "#1f2937" : "#fff",
                borderColor: "#3B82F6",
              },
            ]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={[styles.secondaryText, { color: "#3B82F6" }]}>
              Login
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconWrapper: {
    backgroundColor: "#3B82F6",
    padding: 18,
    borderRadius: 32,
    elevation: 6,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: -1,
    fontFamily: "System",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  featureIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  featureDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  buttons: {
    width: "100%",
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  primaryText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 2,
    paddingVertical: 15,
    borderRadius: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  secondaryText: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
});
