// components/Modal.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal as RNModal } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function Modal({ title, onClose, children, appContext }) {
  const theme = appContext?.theme || "light";
  const isDark = theme === "dark";

  return (
    <RNModal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        <View
          style={[
            styles.modal,
            { backgroundColor: isDark ? "#1f2937" : "#fff" },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? "#fff" : "#111" }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" color={isDark ? "#bbb" : "#555"} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView>{children}</ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
});
