import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import apiService from "../services/api";
import Modal from "../components/Modal";

export default function CategoryCollaborationScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const isDark = theme === "dark";
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Invalid", "Please enter an invite code");
      return;
    }

    setIsLoading(true);
    try {
      const code = inviteCode.trim().toUpperCase();
      const joinResult = await apiService.joinWithCode(code);
      
      setShowJoinModal(false);
      setInviteCode("");

      Alert.alert(
        "🎉 Successfully Joined!",
        `You've joined the ${joinResult.type || 'shared item'}.\n\n👥 You can now collaborate with other members!`,
        [
          { 
            text: "View It", 
            onPress: () => {
              navigation.navigate("SharedBudgets");
            }
          },
          { text: "OK" }
        ]
      );

    } catch (error) {
      console.error('❌ Error joining with code:', error);
      Alert.alert("Join Failed", error.message || "Please check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Safe Back Navigation
  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("MainTabs"); 
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? "#1f2937" : "#3B82F6" }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collaboration Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content}>
        
        {/* Intro Section */}
        <View style={styles.introContainer}>
          <Text style={[styles.mainTitle, { color: isDark ? "#fff" : "#111" }]}>
            Work Together
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Manage shared finances and track expenses with friends and family.
          </Text>
        </View>

        {/* MAIN ACTION: Shared Budgets */}
        <TouchableOpacity
          style={[styles.mainCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("SharedBudgets")}
        >
          <View style={[styles.iconCircle, { backgroundColor: "#10b981" + "15" }]}>
            <Feather name="dollar-sign" size={32} color="#10b981" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#111" }]}>
              Shared Budgets
            </Text>
            <Text style={[styles.cardDescription, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Create expense pools, track joint spending, and manage allowances.
            </Text>
            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>Open Budgets</Text>
              <Feather name="arrow-right" size={16} color="#10b981" />
            </View>
          </View>
        </TouchableOpacity>

        {/* SECONDARY ACTION: Join with Code */}
        <Text style={[styles.sectionHeader, { color: isDark ? "#9ca3af" : "#6b7280" }]}>INVITATIONS</Text>
        
        <TouchableOpacity
          style={[styles.secondaryCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}
          activeOpacity={0.8}
          onPress={() => setShowJoinModal(true)}
        >
          <View style={[styles.smallIcon, { backgroundColor: isDark ? "#374151" : "#f3f4f6" }]}>
            <Feather name="user-plus" size={20} color={isDark ? "#fff" : "#4b5563"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.secondaryTitle, { color: isDark ? "#fff" : "#111" }]}>
              Join with Invite Code
            </Text>
            <Text style={[styles.secondarySubtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Enter a code to join an existing group
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={isDark ? "#4b5563" : "#d1d5db"} />
        </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Join Modal */}
      {showJoinModal && (
        <Modal
          title="Join Collaboration"
          appContext={appContext}
          onClose={() => {
            setShowJoinModal(false);
            setInviteCode("");
          }}
        >
          <View>
            <Text style={{ color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 20, fontSize: 14, lineHeight: 20 }}>
              Enter the 6-character code shared by your friend to join their budget or category.
            </Text>

            <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "600", marginBottom: 8 }}>
              Invite Code
            </Text>
            <TextInput
              placeholder="e.g. X7Y2Z9"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#111827" : "#f8fafc",
                  borderColor: isDark ? "#374151" : "#e2e8f0",
                  color: isDark ? "#fff" : "#111",
                },
              ]}
            />

            <TouchableOpacity
              style={[styles.modalButton, { opacity: isLoading ? 0.7 : 1 }]}
              onPress={handleJoinWithCode}
              disabled={isLoading}
            >
              <Text style={styles.modalButtonText}>
                {isLoading ? "Joining..." : "Join Now"}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 30, // REDUCED from 50 to 20
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  joinButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  content: {
    padding: 20,
  },
  introContainer: {
    marginBottom: 24,
    marginTop: 10,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  mainCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    color: "#10b981",
    fontWeight: "700",
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  secondaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  smallIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  secondaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  secondarySubtitle: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});