// screens/SignupScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";

// --- FIREBASE IMPORTS ---
// Added 'signOut' to imports
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../fintrack/firebase/firebase"; 

export default function SignupScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const isDark = theme === "dark";

  const [signupData, setSignupData] = useState({
    name: "",
    email: "", 
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setSignupData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSignup = async () => {
    if (!signupData.name || !signupData.email || !signupData.password) {
      setAuthError("All fields are required");
      return;
    }

    // Email validation
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(signupData.email)) {
        setAuthError("Please enter a valid email address");
        return;
    }

    // Password minimum length
    const MIN_PASSWORD_LEN = 6;
    if ((signupData.password || "").length < MIN_PASSWORD_LEN) {
      setAuthError(`Password must be at least ${MIN_PASSWORD_LEN} characters`);
      return;
    }

    setLoading(true);
    setAuthError("");

    try {
      console.log("🚀 Starting Signup...");

      // 1. Create User (Firebase auto-logs in)
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        signupData.email, 
        signupData.password
      );
      const user = userCredential.user;

      // 2. Update Profile (Display Name)
      await updateProfile(user, {
        displayName: signupData.name,
      });

      // 3. Save User Data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: signupData.name,
        email: signupData.email,
        currency: "PHP", 
        theme: "light",
        createdAt: serverTimestamp(),
      });
      
      console.log("✅ Account created. Signing out now...");

      // 4. CRITICAL STEP: Sign Out immediately
      // This prevents the App.js listener from sending them to Dashboard
      await signOut(auth);

      // 5. Force Navigation to Login
      setLoading(false);
      
      // Clear form
      setSignupData({ name: "", email: "", password: "" });

      // Use reset to clear history so back button doesn't return to signup
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
      
    } catch (error) {
      console.error("❌ Signup error:", error);
      setLoading(false);
      
      let msg = "Signup failed";
      if (error.code === 'auth/email-already-in-use') msg = "That email is already in use.";
      if (error.code === 'auth/invalid-email') msg = "Invalid email format.";
      if (error.code === 'auth/weak-password') msg = "Password is too weak.";
      setAuthError(msg);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          <View style={[styles.iconContainer, { backgroundColor: "#10b981" + "15" }]}>
            <Ionicons name="person-add" size={40} color="#10b981" />
          </View>
          <Text style={[styles.title, { color: isDark ? "#fff" : "#111" }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Sign up to start tracking your finances
          </Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
          
          {/* NAME INPUT */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDark ? "#d1d5db" : "#374151" }]}>
              Full Name
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: isDark ? "#374151" : "#e5e7eb" }]}>
              <Ionicons name="person-outline" size={20} color={isDark ? "#9ca3af" : "#6b7280"} style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your full name"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                value={signupData.name}
                onChangeText={(val) => handleChange("name", val)}
                style={[styles.input, { color: isDark ? "#fff" : "#111" }]}
              />
            </View>
          </View>

          {/* EMAIL INPUT (Replaced Phone) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: isDark ? "#d1d5db" : "#374151" }]}>
              Email Address
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: isDark ? "#374151" : "#e5e7eb" }]}>
              <Ionicons name="mail-outline" size={20} color={isDark ? "#9ca3af" : "#6b7280"} style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                value={signupData.email}
                onChangeText={(val) => handleChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { color: isDark ? "#fff" : "#111" }]}
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
                placeholder="Create a password"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                secureTextEntry={!showPassword}
                value={signupData.password}
                onChangeText={(val) => handleChange("password", val)}
                style={[styles.input, { color: isDark ? "#fff" : "#111" }]}
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
            style={[styles.signupButton, loading && styles.signupButtonDisabled]} 
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.signupText}>Sign Up</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]} />
            <Text style={[styles.dividerText, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
              Already have an account?
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]} />
          </View>

          <TouchableOpacity
            style={[styles.loginLink, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={[styles.loginLinkText, { color: "#10b981" }]}>
              Login Instead
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// --- STYLES (Unchanged from your original code) ---
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
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
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
    marginBottom: 28,
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
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formCard: {
    borderRadius: 20,
    padding: 24,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
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
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  error: {
    color: "#ef4444",
    fontSize: 14,
    flex: 1,
  },
  signupButton: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    elevation: 2,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
  },
  loginLink: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#10b981",
  },
  loginLinkText: {
    fontSize: 16,
    fontWeight: "600",
  },
});