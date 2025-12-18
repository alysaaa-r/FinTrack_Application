// screens/LoginScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";

// --- FIREBASE IMPORTS ---
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../fintrack/firebase/firebase"; 

export default function LoginScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const setCurrentUser = appContext?.setCurrentUser;
  const isDark = theme === "dark";

  // Changed 'phone' to 'email'
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setLoginData((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogin = async () => {
    if (!loginData.email || !loginData.password) {
      setAuthError("Please enter email and password");
      return;
    }

    setLoading(true);
    setAuthError("");

    try {
      // 1. Sign In with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        loginData.email, 
        loginData.password
      );
      const user = userCredential.user;

      // 2. Fetch User Profile from Firestore
      // We need this to get the 'name', 'currency', etc. that aren't in the basic Auth object
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // User data found in database
        const userData = docSnap.data();
        if (setCurrentUser) {
            setCurrentUser(userData);
        }
      } else {
        // Fallback if no firestore doc (rare)
        console.warn("No user profile found in Firestore");
        if (setCurrentUser) {
            setCurrentUser({ uid: user.uid, email: user.email, name: "User" });
        }
      }

      // 3. Navigate to App
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });

    } catch (error) {
      console.error("Login error:", error);
      let msg = "Login failed";
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        msg = "Invalid email or password.";
      } else if (error.code === "auth/invalid-email") {
        msg = "Invalid email format.";
      } else if (error.code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Try again later.";
      }
      setAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Welcome")}
        >
          <View style={[styles.backButtonCircle, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
            <Ionicons name="arrow-back" color={isDark ? "#fff" : "#111"} size={24} />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: "#3B82F6" + "15" }]}>
            <Ionicons name="lock-closed" size={40} color="#3B82F6" />
          </View>
          <Text style={[styles.title, { color: isDark ? "#fff" : "#111" }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Login to continue tracking your finances
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
          
          {/* EMAIL INPUT (Replaces Phone) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDark ? "#d1d5db" : "#374151" }]}>
              Email Address
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: isDark ? "#374151" : "#e5e7eb" }]}>
              <Ionicons name="mail-outline" size={20} color={isDark ? "#9ca3af" : "#6b7280"} style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                value={loginData.email}
                onChangeText={(val) => handleChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.input,
                  {
                    color: isDark ? "#fff" : "#111",
                  },
                ]}
              />
            </View>
          </View>

          {/* PASSWORD INPUT */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDark ? "#d1d5db" : "#374151" }]}>
              Password
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: isDark ? "#374151" : "#e5e7eb" }]}>
              <Ionicons name="lock-closed-outline" size={20} color={isDark ? "#9ca3af" : "#6b7280"} style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                secureTextEntry={!showPassword}
                value={loginData.password}
                onChangeText={(val) => handleChange("password", val)}
                style={[
                  styles.input,
                  {
                    color: isDark ? "#fff" : "#111",
                  },
                ]}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} color={isDark ? "#9ca3af" : "#6b7280"} size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {authError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.error}>{authError}</Text>
            </View>
          ) : null}

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginText}>Login</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]} />
            <Text style={[styles.dividerText, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
              Don't have an account?
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]} />
          </View>

          <TouchableOpacity
            style={[styles.signupLink, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}
            onPress={() => navigation.navigate("Signup")}
          >
            <Text style={[styles.signupLinkText, { color: "#3B82F6" }]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 50,
  },
  backButton: {
    marginBottom: 30,
    alignSelf: "flex-start",
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formCard: {
    borderRadius: 20,
    padding: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  error: {
    color: "#ef4444",
    fontSize: 14,
    flex: 1,
  },
  loginButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    elevation: 2,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    fontWeight: "500",
  },
  signupLink: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  signupLinkText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
});