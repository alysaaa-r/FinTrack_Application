import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons, Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';

// --- FIREBASE IMPORTS ---
import { signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../fintrack/firebase/firebase"; 

export default function SettingsScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const setTheme = appContext?.setTheme;
  const currency = appContext?.currency || "PHP";
  const setCurrency = appContext?.setCurrency;
  const currentUser = appContext?.currentUser;
  const setCurrentUser = appContext?.setCurrentUser;
  const isDark = theme === "dark";

  // --- STATE ---
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false); // <--- NEW: About Modal State

  const [newCurrency, setNewCurrency] = useState(currency);
  
  // Profile Editing State
  const [editName, setEditName] = useState(currentUser?.name || "");
  const [editUsername, setEditUsername] = useState(currentUser?.username || "");
  const [uploading, setUploading] = useState(false);

  const currencyOptions = ["PHP", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CNY"];

  // Data for About Us (Alphabetized)
  const teamMembers = [
    "Amoncio, Jahlila",
    "Asas, Kent Jayson",
    "Bagares, Francis",
    "Boyoro, Liezel",
    "Degracia, Ma. Raven",
    "Garay, Stephanie",
    "Gavas, Marianne",
    "Lomocho, Jia",
    "Olasiman, Lea",
    "Quisto, Karylle",
  ];

  // Sync local state when user data loads
  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || "");
      setEditUsername(currentUser.username || "");
    }
  }, [currentUser]);

  // --- ACTIONS ---

  const handleThemeToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleCurrencyChange = () => {
    if (!newCurrency.trim()) {
      Alert.alert("Invalid", "Currency symbol cannot be empty.");
      return;
    }
    setCurrency(newCurrency.trim().toUpperCase());
    setCurrencyModalVisible(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch (error) {
      Alert.alert("Error", "Failed to logout");
    }
  };

  // --- PROFILE IMAGE LOGIC ---
  
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Needed", "Please allow access to your photos in Settings.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2, 
        base64: true, 
      });

      if (!result.canceled) {
        handleImageUpload(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Image Picker Error:", error);
      Alert.alert("Error", "Could not open photo gallery.");
    }
  };

  const handleImageUpload = async (base64Data) => {
    if (!currentUser?.uid) return;
    setUploading(true);

    try {
      const imageString = `data:image/jpeg;base64,${base64Data}`;

      if (imageString.length > 1000000) {
        Alert.alert("Photo too large", "Please choose a smaller or simpler photo.");
        setUploading(false);
        return;
      }

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { profileImage: imageString });

      setCurrentUser({ ...currentUser, profileImage: imageString });
      Alert.alert("Success", "Profile picture updated!");
      
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save profile picture.");
    } finally {
      setUploading(false);
    }
  };

  const saveProfileDetails = async () => {
    if (!currentUser?.uid) return;
    setUploading(true);

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { name: editName, username: editUsername });
      
      setCurrentUser({ ...currentUser, name: editName, username: editUsername });
      setProfileModalVisible(false);
      Alert.alert("Success", "Profile details updated!");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setUploading(false);
    }
  };

  // Display Logic
  const displayName = currentUser?.name || currentUser?.username || "User";
  const displaySubtext = currentUser?.username ? `@${currentUser.username}` : currentUser?.email;

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: isDark ? "#0b1220" : "#f7fafc" }]}>
      
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: isDark ? "#fff" : "#0f172a" }]}>Settings</Text>
      </View>

      {/* --- PERSONAL INFORMATION CARD --- */}
      <TouchableOpacity 
        style={[styles.personalInfoCard, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb" }]}
        onPress={() => setProfileModalVisible(true)}
      >
        <View style={styles.profileIconContainer}>
          {uploading ? (
            <ActivityIndicator color="#3B82F6" />
          ) : currentUser?.profileImage ? (
            <Image source={{ uri: currentUser.profileImage }} style={styles.profileImageFull} />
          ) : (
            <Feather name="user" size={32} color={isDark ? "#60A5FA" : "#3B82F6"} />
          )}
          <View style={styles.editIconOverlay}>
              <Feather name="camera" size={10} color="#fff" />
          </View>
        </View>

        <View style={styles.infoTextContainer}>
          <Text style={[styles.sectionLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Personal Information
          </Text>
          <Text style={[styles.userNameText, { color: isDark ? "#fff" : "#111" }]}>
            {displayName}
          </Text>
          <Text style={[styles.userEmailText, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
            {displaySubtext}
          </Text>
        </View>

        <View style={[styles.editButtonSmall, { backgroundColor: isDark ? "#374151" : "#f3f4f6" }]}>
             <Feather name="edit-2" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
        </View>
      </TouchableOpacity>

      {/* --- APPEARANCE --- */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0f1724" : "#fff" }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#0f172a" }]}>Appearance</Text>
          <Text style={[styles.cardSubtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Customize your app theme</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={[styles.labelSmall, { color: isDark ? "#fff" : "#111" }]}>Dark Mode</Text>
          <Switch value={isDark} onValueChange={handleThemeToggle} />
        </View>
      </View>

      {/* --- CURRENCY --- */}
      <View style={[styles.card, { backgroundColor: isDark ? "#0f1724" : "#fff" }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#0f172a" }]}>Currency</Text>
          <Text style={[styles.cardSubtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Select default currency</Text>
        </View>
        <View style={styles.rowBetween}>
          <TouchableOpacity
            style={[styles.dropdownButton, { backgroundColor: isDark ? "#0b1226" : "#f3f4f6" }]}
            onPress={() => setCurrencyModalVisible(true)}
          >
            <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16 }}>{newCurrency}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostButton} onPress={handleCurrencyChange}>
            <Text style={[styles.ghostText]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- NEW: ABOUT US BUTTON --- */}
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: isDark ? "#0f1724" : "#fff", paddingVertical: 18, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}
        onPress={() => setAboutModalVisible(true)}
      >
        <View>
            <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#0f172a" }]}>About FinTrack</Text>
            <Text style={[styles.cardSubtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Credits & Info</Text>
        </View>
        <Feather name="info" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <MaterialIcons name="logout" color="#fff" size={20} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* --- MODALS --- */}
      
      {/* Currency Modal */}
      <Modal visible={currencyModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#0b1226" : "#fff" }]}>
            <Text style={[styles.title, { fontSize: 18, color: isDark ? "#fff" : "#111" }]}>Choose currency</Text>
            <ScrollView style={{ marginTop: 12 }}>
              {currencyOptions.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => {
                    setNewCurrency(c);
                    setCurrency(c);
                    setCurrencyModalVisible(false);
                  }}
                  style={styles.currencyOption}
                >
                  <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16 }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: "#6b7280", marginTop: 15 }]} onPress={() => setCurrencyModalVisible(false)}>
                <Text style={styles.saveText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={profileModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#0b1226" : "#fff" }]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
                <Text style={[styles.title, { fontSize: 18, color: isDark ? "#fff" : "#111", marginBottom:0 }]}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                    <Feather name="x" size={24} color={isDark ? "#fff" : "#333"} />
                </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginBottom: 20, zIndex: 10 }}>
                <TouchableOpacity 
                    onPress={pickImage} 
                    activeOpacity={0.7}
                    style={{ alignItems: 'center', padding: 10 }}
                >
                    <View style={styles.profileIconLarge}>
                        {currentUser?.profileImage ? (
                            <Image source={{ uri: currentUser.profileImage }} style={styles.profileImageFull} />
                        ) : (
                            <Feather name="user" size={35} color={isDark ? "#3B82F6" : "#2563eb"} />
                        )}
                        <View style={[styles.editIconOverlay, { width: 28, height: 28, borderRadius: 14, bottom: -4, right: -4 }]}>
                            <Feather name="camera" size={14} color="#fff" />
                        </View>
                    </View>
                    <Text style={{ color: '#3B82F6', marginTop: 12, fontSize: 15, fontWeight: '600' }}>
                        Change Profile Photo
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.labelSmall, { color: isDark ? "#fff" : "#111", marginBottom: 8 }]}>Full Name</Text>
            <TextInput 
                value={editName}
                onChangeText={setEditName}
                style={[styles.input, { color: isDark ? "#fff" : "#111", backgroundColor: isDark ? "#1f2937" : "#f3f4f6", borderColor: isDark ? "#374151" : "#e5e7eb" }]}
                placeholder="Enter your name"
                placeholderTextColor="#999"
            />

            <Text style={[styles.labelSmall, { color: isDark ? "#fff" : "#111", marginBottom: 8, marginTop: 16 }]}>Username</Text>
            <TextInput 
                value={editUsername}
                onChangeText={setEditUsername}
                style={[styles.input, { color: isDark ? "#fff" : "#111", backgroundColor: isDark ? "#1f2937" : "#f3f4f6", borderColor: isDark ? "#374151" : "#e5e7eb" }]}
                placeholder="@username"
                placeholderTextColor="#999"
                autoCapitalize="none"
            />

            <TouchableOpacity 
                style={[styles.saveButton, { marginTop: 25, opacity: uploading ? 0.6 : 1 }]} 
                onPress={saveProfileDetails}
                disabled={uploading}
            >
                {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- ABOUT US MODAL (NEW) --- */}
      <Modal visible={aboutModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#0b1226" : "#fff", height: '85%', padding: 0 }]}>
            
            {/* Fixed Header */}
            <View style={{padding: 20, borderBottomWidth:1, borderColor: isDark ? '#374151' : '#e5e7eb', flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <View>
                    <Text style={[styles.title, { fontSize: 20, color: isDark ? "#fff" : "#111", marginBottom: 2 }]}>About FinTrack</Text>
                    <Text style={{color: '#3B82F6', fontWeight: '600', fontSize: 12}}>IT ELECTIVE 1 - Group 2 / BSIT 3 - Block 8</Text>
                </View>
                <TouchableOpacity onPress={() => setAboutModalVisible(false)}>
                    <Feather name="x" size={24} color={isDark ? "#fff" : "#333"} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{padding: 20}}>
                {/* Description */}
                <View style={{marginBottom: 20}}>
                    <Text style={{color: isDark ? '#d1d5db' : '#4b5563', lineHeight: 22}}>
                        FinTrack is a comprehensive financial tracking application designed to help students and individuals manage their shared expenses and personal budgets effectively.
                    </Text>
                </View>

                {/* Leader Section */}
                <Text style={[styles.sectionLabel, {color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 8}]}>Team Leader</Text>
                <View style={[styles.teamCard, {backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff', borderColor: '#3B82F6', borderWidth: 1}]}>
                    <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent:'center', alignItems:'center', marginRight: 12}}>
                        <Text style={{color: '#fff', fontWeight:'bold', fontSize: 18}}>A</Text>
                    </View>
                    <View>
                        <Text style={{color: isDark ? '#fff' : '#1e3a8a', fontWeight: '700', fontSize: 16}}>Alyssa H. Requillo</Text>
                        <Text style={{color: isDark ? '#93c5fd' : '#3b82f6', fontSize: 12}}>Project Leader</Text>
                    </View>
                </View>

                {/* Members Section */}
                <Text style={[styles.sectionLabel, {color: isDark ? '#9ca3af' : '#6b7280', marginTop: 20, marginBottom: 8}]}>Members</Text>
                <View style={[styles.membersContainer, {backgroundColor: isDark ? '#1f2937' : '#f8fafc', borderColor: isDark ? '#374151' : '#e2e8f0'}]}>
                    {teamMembers.map((member, index) => (
                        <View key={index} style={[styles.memberRow, {borderBottomColor: isDark ? '#374151' : '#e2e8f0', borderBottomWidth: index === teamMembers.length - 1 ? 0 : 1}]}>
                            <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? '#6b7280' : '#cbd5e1', marginRight: 12}} />
                            <Text style={{color: isDark ? '#e5e7eb' : '#334155', fontSize: 15}}>{member}</Text>
                        </View>
                    ))}
                </View>

                {/* Teacher Section */}
                <View style={{marginTop: 25, alignItems:'center', padding: 15, backgroundColor: isDark ? '#374151' : '#f1f5f9', borderRadius: 12}}>
                    <Text style={{color: isDark ? '#9ca3af' : '#64748b', fontSize: 12, textTransform:'uppercase', marginBottom: 4}}>Subject Teacher</Text>
                    <Text style={{color: isDark ? '#fff' : '#0f172a', fontWeight: '700', fontSize: 16}}>Jay Ian F. Camelotes</Text>
                </View>

                {/* Footer */}
                <Text style={{textAlign:'center', marginTop: 30, color: isDark ? '#4b5563' : '#94a3b8', fontSize: 12}}>
                    v1.0.0 • Built with React Native & Firebase
                </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20 },
  headerRow: { marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 6 },
  
  // --- PERSONAL INFO CARD STYLES ---
  personalInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  profileIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    position: 'relative',
  },
  profileImageFull: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  editIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  infoTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmailText: {
    fontSize: 13,
  },
  editButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // --- MODAL STYLES ---
  profileIconLarge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: "rgba(59, 130, 246, 0.1)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 0, 
      position: 'relative',
      borderWidth: 1,
      borderColor: 'rgba(59, 130, 246, 0.2)'
  },
  
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  cardHeader: { marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, marginTop: 4 },
  labelSmall: { fontSize: 14, fontWeight: "600" },
  
  dropdownButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 120,
    justifyContent: "center",
  },
  ghostButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  ghostText: { color: "#2563eb", fontWeight: "700" },
  
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { width: "90%", padding: 20, borderRadius: 16 },
  currencyOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#e6e6e6" },
  
  saveButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  
  input: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
  },

  // --- ABOUT US STYLES ---
  teamCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
  },
  membersContainer: {
      borderRadius: 12,
      borderWidth: 1,
      overflow: 'hidden'
  },
  memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
  }
});