import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

// --- FIREBASE IMPORTS ---
import { db } from '../fintrack/firebase/firebase'; 
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  query, 
  where, 
  serverTimestamp, 
  arrayUnion, 
  increment,
  deleteDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';

import api from "../services/api"; 
import Modal from "../components/Modal";

export default function SharedBudgetsScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const currency = appContext?.currency || "PHP";
  const currentUser = appContext?.currentUser || null;
  const isDark = theme === "dark";

  const userId = currentUser?.uid || currentUser?.id;

  // --- UI STATES ---
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  
  const [newCategoryName, setNewCategoryName] = useState("");
  const [budgetTitle, setBudgetTitle] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // --- DATA STATES ---
  const [categoriesWithBudgets, setCategoriesWithBudgets] = useState({});
  const [allCategories, setAllCategories] = useState({});
  const [rawBudgets, setRawBudgets] = useState([]); 
  
  const [refreshing, setRefreshing] = useState(false);
  
  // --- LIVE MODAL STATES ---
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);
  const [showContributeModal, setShowContributeModal] = useState(false);
  
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeType, setContributeType] = useState("add");
  
  // --- CURRENCY STATES ---
  const selectedCurrencyRef = useRef(currency); 
  const [contributeCurrency, setContributeCurrency] = useState(currency); 
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createCurrency, setCreateCurrency] = useState(currency); 
  const [showCreateCurrencyDropdown, setShowCreateCurrencyDropdown] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [convertedAmount, setConvertedAmount] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  
  const currencies = [
    { code: "PHP", name: "Philippine Peso", symbol: "₱" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
    { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
    { code: "KRW", name: "Korean Won", symbol: "₩" },
  ];

  // Helper: Get the LIVE budget object
  const activeBudget = selectedBudgetId ? rawBudgets.find(b => b.id === selectedBudgetId) : null;

  useEffect(() => {
    setContributeCurrency(currency);
    setCreateCurrency(currency);
    selectedCurrencyRef.current = currency;
  }, [currency]);

  // --- FIREBASE LISTENERS ---
  
  // 1. Listen for My Categories
  useEffect(() => {
    if (!userId) return;
    const categoriesRef = collection(db, 'users', userId, 'categories');
    const unsubscribe = onSnapshot(categoriesRef, (snapshot) => {
      const categoriesData = {};
      snapshot.forEach(doc => {
        categoriesData[doc.data().name] = { ...doc.data(), id: doc.id };
      });
      setAllCategories(categoriesData);
    }, (error) => console.log("Category sync error", error));
    return () => unsubscribe();
  }, [userId]);

  // 2. Listen for Budgets
  useEffect(() => {
    if (!userId) return;
    const budgetsRef = collection(db, 'shared_budgets');
    const q = query(budgetsRef, where("participants", "array-contains", userId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedBudgets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRawBudgets(fetchedBudgets);
    }, (error) => console.log("Budget sync error", error));
    return () => unsubscribe();
  }, [userId]);

  // Organize Data
  useEffect(() => {
    const organizedData = {};
    Object.entries(allCategories).forEach(([name, data]) => {
      organizedData[name] = {
        ...data,
        sharedBudgets: rawBudgets.filter(b => b.category === name)
      };
    });
    rawBudgets.forEach(budget => {
      if (!organizedData[budget.category]) {
        organizedData[budget.category] = {
          color: "#9ca3af",
          icon: "users",
          sharedBudgets: [budget]
        };
      }
    });
    setCategoriesWithBudgets(organizedData);
  }, [rawBudgets, allCategories]);

  // --- CURRENCY PREVIEW ---
  useEffect(() => {
    const calculateConversion = async () => {
      if (!activeBudget || !contributeAmount || !contributeCurrency) return;
      
      const amount = parseFloat(contributeAmount);
      if (isNaN(amount) || amount <= 0) {
        setConvertedAmount("");
        setExchangeRate(1);
        return;
      }

      const budgetCurrency = activeBudget.currency || currency;
      
      if (contributeCurrency === budgetCurrency) {
        setConvertedAmount(amount.toFixed(2));
        setExchangeRate(1);
        return;
      }

      try {
        const result = await api.convertCurrency(amount, contributeCurrency, budgetCurrency);
        if (result && result.convertedAmount) {
            setConvertedAmount(result.convertedAmount.toFixed(2));
            setExchangeRate(result.rate);
        }
      } catch (error) {
        setConvertedAmount("");
      }
    };

    calculateConversion();
  }, [contributeCurrency, contributeAmount, activeBudget]);

  // --- ACTIONS ---

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (!userId) return;
    const CATEGORY_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    const CATEGORY_ICONS = ["tag", "shopping-bag", "home", "coffee", "gift", "heart"];
    const existingCount = Object.keys(allCategories).length;
    try {
      await addDoc(collection(db, 'users', userId, 'categories'), {
        name: newCategoryName.trim(),
        color: CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length],
        icon: CATEGORY_ICONS[existingCount % CATEGORY_ICONS.length],
        createdAt: serverTimestamp()
      });
      setShowCreateCategoryModal(false);
      setNewCategoryName("");
      setShowCategoryModal(true);
    } catch (error) {
      Alert.alert("Error", "Could not create category.");
    }
  };

  const handleCreate = async () => {
    if (!selectedCategory || !budgetTitle.trim() || !budgetAmount) return;
    try {
      await addDoc(collection(db, 'shared_budgets'), {
        category: selectedCategory,
        title: budgetTitle.trim(),
        targetAmount: parseFloat(budgetAmount),
        currentAmount: 0,
        currency: createCurrency,
        ownerId: userId,
        ownerName: currentUser.name || "User",
        participants: [userId],
        sharedWith: [],
        contributions: [],
        createdAt: serverTimestamp(),
      });
      setShowCreateModal(false);
      setSelectedCategory(null);
      setBudgetTitle("");
      setBudgetAmount("");
    } catch (error) {
      Alert.alert("Error", "Failed to create shared budget.");
    }
  };

  const handleContribute = async () => {
      if (!contributeAmount) return;
      if (!activeBudget) return; 

      setIsLoading(true);
      try {
          const budgetCurrency = activeBudget.currency || currency;
          let amountInBudgetCurrency = parseFloat(contributeAmount);
          let currentExchangeRate = 1;

          if (contributeCurrency !== budgetCurrency) {
            try {
                const result = await api.convertCurrency(parseFloat(contributeAmount), contributeCurrency, budgetCurrency);
                if (result && result.convertedAmount) {
                    amountInBudgetCurrency = result.convertedAmount;
                    currentExchangeRate = result.rate;
                }
            } catch (e) { console.warn("Conversion failed"); }
          }

          const contribution = {
            id: Date.now().toString(),
            userId: userId,
            userName: currentUser.name || "User",
            amount: parseFloat(contributeAmount),
            amountInBudgetCurrency: amountInBudgetCurrency,
            currency: contributeCurrency,
            exchangeRate: currentExchangeRate,
            type: contributeType,
            date: new Date().toISOString(),
          };
          
          const budgetRef = doc(db, 'shared_budgets', activeBudget.id);
          const change = contributeType === "add" ? amountInBudgetCurrency : -amountInBudgetCurrency;
          
          await updateDoc(budgetRef, {
              currentAmount: increment(change),
              contributions: arrayUnion(contribution)
          });
          
          setShowContributeModal(false);
          setContributeAmount("");
          setSelectedBudgetId(null);
          Alert.alert("Success", "Transaction synced to cloud!");
      } catch(e) { 
        console.error(e);
        Alert.alert("Error", "Failed to sync."); 
      } finally { 
        setIsLoading(false); 
      }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      enabled
    >
        <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f3f4f6" }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: isDark ? "#1f2937" : "#10b981" }]}>
            <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Shared Budgets</Text>

            <View style={{ flexDirection: 'row', gap: 15 }}>
                {/* Create Category Button */}
                <TouchableOpacity onPress={() => setShowCategoryModal(true)}>
                    <Feather name="folder-plus" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} />}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
            {Object.keys(categoriesWithBudgets).length === 0 ? (
            <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>No shared budgets found</Text>
            </View>
            ) : (
            Object.entries(categoriesWithBudgets).map(([categoryName, data]) => {
                return (
                <View key={categoryName} style={styles.section}>
                    <View style={[styles.categoryHeaderCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
                    <View style={styles.categoryHeaderContent}>
                        <View style={[styles.categoryIconLarge, { backgroundColor: (data.color || "#3B82F6") + "20" }]}>
                        <Feather name={data.icon || "tag"} size={28} color={data.color || "#3B82F6"} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.categoryNameLarge, { color: isDark ? "#fff" : "#111" }]}>{categoryName}</Text>
                        <Text style={[styles.categoryBudgetsCount, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                            {data.sharedBudgets?.length || 0} shared budgets
                        </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                        
                        {/* ADD BUDGET BUTTON */}
                        <TouchableOpacity
                            style={[styles.categoryActionBtn, { backgroundColor: "#10b981" }]}
                            onPress={() => {
                            setSelectedCategory(categoryName);
                            setShowCreateModal(true);
                            }}
                        >
                            <Feather name="plus" size={20} color="#fff" />
                        </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity 
                        style={{marginTop: 10}}
                        onPress={() => navigation.navigate("CategoryDetail", { categoryName, categoryData: data, isSharedView: true, categoryBudgets: data.sharedBudgets })}
                    >
                        <Text style={{color: '#3B82F6', fontWeight: '600'}}>View Budgets →</Text>
                    </TouchableOpacity>
                    </View>
                </View>
                );
            })
            )}
        </ScrollView>

        {showCreateCategoryModal && (
            <Modal title="Create Category" appContext={appContext} onClose={() => setShowCreateCategoryModal(false)}>
                <TextInput 
                    placeholder="Category Name" 
                    value={newCategoryName} 
                    onChangeText={setNewCategoryName}
                    style={[styles.input, {color: isDark ? "#fff" : "#000", marginBottom: 10}]}
                    placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.modalButton} onPress={handleCreateCategory}>
                    <Text style={styles.modalButtonText}>Save Category</Text>
                </TouchableOpacity>
            </Modal>
        )}
        
        {showCategoryModal && (
            <Modal title="Select Category" appContext={appContext} onClose={() => setShowCategoryModal(false)}>
                <ScrollView style={{maxHeight: 300}}>
                    {Object.entries(allCategories).map(([name, data]) => (
                        <TouchableOpacity key={name} onPress={() => { setSelectedCategory(name); setShowCategoryModal(false); setShowCreateModal(true); }} style={{padding: 15, borderBottomWidth: 1, borderColor: '#eee'}}>
                            <Text style={{color: isDark ? '#fff' : '#000'}}>{name}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => { setShowCategoryModal(false); setShowCreateCategoryModal(true); }} style={{padding: 15}}>
                        <Text style={{color: '#3B82F6'}}>+ Create New</Text>
                    </TouchableOpacity>
                </ScrollView>
            </Modal>
        )}

        {showCreateModal && (
            <Modal title="New Budget" appContext={appContext} onClose={() => setShowCreateModal(false)}>
                <Text style={{color: isDark ? '#fff' : '#000', marginBottom: 5}}>Category: {selectedCategory}</Text>
                <TextInput placeholder="Title" value={budgetTitle} onChangeText={setBudgetTitle} style={[styles.input, {color: isDark ? '#fff' : '#000', marginBottom: 10}]} placeholderTextColor="#999"/>
                <TextInput placeholder="Amount" value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="numeric" style={[styles.input, {color: isDark ? '#fff' : '#000', marginBottom: 10}]} placeholderTextColor="#999"/>
                <TouchableOpacity style={styles.modalButton} onPress={handleCreate}><Text style={styles.modalButtonText}>Create</Text></TouchableOpacity>
            </Modal>
        )}

        {/* Contribute Modal */}
        {showContributeModal && activeBudget && (
            <Modal
            title={`${contributeType === "add" ? "Add to" : "Spend from"} Budget`}
            appContext={appContext}
            onClose={() => {
                setShowContributeModal(false);
                setSelectedBudgetId(null);
                setContributeAmount("");
            }}
            >
            <View>
                <Text style={{color: isDark ? "#fff" : "#111", fontSize: 16, marginBottom: 10, fontWeight: '600'}}>
                {activeBudget.title}
                </Text>
                <Text style={{color: isDark ? "#9ca3af" : "#6b7280", fontSize: 14, marginBottom: 15}}>
                Current: {activeBudget.currency} {activeBudget.currentAmount?.toFixed(2)}
                </Text>
                
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <TouchableOpacity style={[styles.contributeTypeButton, { flex: 1, backgroundColor: contributeType === "add" ? "#10b981" : "#374151" }]} onPress={() => setContributeType("add")}>
                    <Text style={{color: '#fff', fontWeight:'600'}}>Add Money</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.contributeTypeButton, { flex: 1, backgroundColor: contributeType === "expense" ? "#ef4444" : "#374151" }]} onPress={() => setContributeType("expense")}>
                    <Text style={{color: '#fff', fontWeight:'600'}}>Spend</Text>
                </TouchableOpacity>
                </View>

                <TextInput 
                    placeholder="Amount" 
                    value={contributeAmount} 
                    onChangeText={setContributeAmount} 
                    keyboardType="numeric"
                    style={[styles.input, {color: isDark ? '#fff' : '#000', borderColor: isDark ? '#555' : '#ccc', marginBottom: 10}]}
                    placeholderTextColor="#999"
                />

                {/* Conversion Preview */}
                {convertedAmount && contributeCurrency !== (activeBudget.currency || currency) && (
                <Text style={{color: '#3B82F6', fontSize: 12, marginBottom: 10}}>
                    ≈ {convertedAmount} {activeBudget.currency} (Rate: {exchangeRate.toFixed(4)})
                </Text>
                )}

                <TouchableOpacity style={[styles.modalButton, { backgroundColor: "#10b981", opacity: isLoading ? 0.6 : 1 }]} onPress={handleContribute} disabled={isLoading}>
                <Text style={styles.modalButtonText}>{isLoading ? "Processing..." : "Confirm"}</Text>
                </TouchableOpacity>
            </View>
            </Modal>
        )}
        </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 20, paddingTop: 30 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  section: { paddingHorizontal: 20, marginTop: 20 },
  summaryCard: { borderRadius: 16, padding: 20, elevation: 2 },
  summaryTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  summarySubtitle: { fontSize: 14 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, marginTop: 20 },
  categoryHeaderCard: { borderRadius: 16, padding: 16, elevation: 2, marginBottom: 12 },
  categoryHeaderContent: { flexDirection: "row", alignItems: "center" },
  categoryIconLarge: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  categoryNameLarge: { fontSize: 20, fontWeight: "700" },
  categoryBudgetsCount: { fontSize: 14, marginTop: 4 },
  categoryActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", elevation: 2 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  modalButton: { backgroundColor: "#10b981", paddingVertical: 14, borderRadius: 12, marginTop: 20 },
  modalButtonText: { color: "#fff", fontSize: 16, textAlign: "center", fontWeight: "600" },
  contributeTypeButton: { padding: 12, borderRadius: 10, alignItems: "center" },
  categorySelectButton: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, gap: 12 },
  categorySelectIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  categorySelectText: { flex: 1, fontSize: 16, fontWeight: "600" },
  dropdown: { borderWidth: 1, borderRadius: 10, maxHeight: 200, overflow: "hidden" },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  dropdownItemText: { fontSize: 16 }
});