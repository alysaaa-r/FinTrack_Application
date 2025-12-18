// components/BottomNav.js
import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { MaterialIcons, Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function BottomNav({ navigation, active }) {
  const tabs = [
    { name: "Dashboard", key: "Dashboard", icon: (props) => <MaterialIcons name="account-balance-wallet" {...props} /> },
    { name: "Expenses", key: "Expenses", icon: (props) => <Feather name="trending-up" {...props} /> },
  { name: "Budget", key: "Budget", icon: (props) => <MaterialIcons name="pie-chart" {...props} /> },
    { name: "Settings", key: "Settings", icon: (props) => <Ionicons name="settings-outline" {...props} /> },
  ];

  return (
    <View style={styles.outer} pointerEvents="box-none">
      <View style={styles.container}>
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = active === tab.name;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => navigation.navigate(tab.name)}
              activeOpacity={0.8}
              style={styles.tabWrapper}
            >
              <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                {Icon({ color: isActive ? "#fff" : "#6b7280", size: 20 })}
              </View>
              <Text style={[styles.tabLabel, isActive ? styles.labelActive : styles.labelInactive]} numberOfLines={1}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
    backgroundColor: "transparent",
  },
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 6,
  },
  tabWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginBottom: 4,
  },
  iconBoxActive: {
    backgroundColor: "#2563eb",
    shadowColor: "#2563eb",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  labelActive: { color: "#2563eb" },
  labelInactive: { color: "#6b7280" },
});
