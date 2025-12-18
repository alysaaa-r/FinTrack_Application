// screens/DashboardScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  RefreshControl,
  Clipboard,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { mockBudgets, mockExpenses, invitationCodes } from "../utils/mockData";
import Modal from "../components/Modal";
import CurrencyRateWidget from "../components/CurrencyRateWidget"; // Ensure this path is correct
import { generateInviteCode } from "../utils/helpers";

const DEFAULT_CATEGORIES = {
  Food: { budget: 0, spent: 0, color: "#FF6B6B" },
  Transportation: { budget: 0, spent: 0, color: "#4ECDC4" },
  Shopping: { budget: 0, spent: 0, color: "#95E1D3" },
  Bills: { budget: 0, spent: 0, color: "#FFA07A" },
};

const CATEGORY_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#95E1D3",
  "#FFA07A",
  "#60A5FA",
  "#34D399",
  "#A78BFA",
  "#F59E0B",
  "#F472B6",
];

const cloneCategoryTemplate = (template) =>
  Object.fromEntries(
    Object.entries(template).map(([name, values]) => [name, { ...values }])
  );

const pickColorForCategory = (name, existingCategories = {}) => {
  if (existingCategories[name]?.color) return existingCategories[name].color;
  if (DEFAULT_CATEGORIES[name]?.color) return DEFAULT_CATEGORIES[name].color;

  const usedColors = new Set(
    Object.values(existingCategories)
      .map((cat) => cat.color)
      .filter(Boolean)
  );

  for (const color of CATEGORY_COLORS) {
    if (!usedColors.has(color)) return color;
  }

  return CATEGORY_COLORS[0];
};

export default function DashboardScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const currency = appContext?.currency || "PHP";
  const currentUser = appContext?.currentUser || null;
  const isDark = theme === "dark";

  // --- state ---
  const [budgets, setBudgets] = useState({
    today: { total: 0, spent: 0 },
    week: { total: 0, spent: 0 },
    month: { total: 0, spent: 0 },
  });
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(() => cloneCategoryTemplate(DEFAULT_CATEGORIES));

  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, currentUser]);

  const ensureUserBudgetStructure = () => {
    if (!currentUser) return null;

    if (!mockBudgets[currentUser.id]) {
      mockBudgets[currentUser.id] = {
        today: { total: 0, spent: 0 },
        week: { total: 0, spent: 0 },
        month: { total: 0, spent: 0 },
        categories: cloneCategoryTemplate(DEFAULT_CATEGORIES),
      };
    } else {
      const userBudget = mockBudgets[currentUser.id];
      userBudget.today = userBudget.today || { total: 0, spent: 0 };
      userBudget.week = userBudget.week || { total: 0, spent: 0 };
      userBudget.month = userBudget.month || { total: 0, spent: 0 };
      userBudget.categories = userBudget.categories || cloneCategoryTemplate(DEFAULT_CATEGORIES);
    }

    return mockBudgets[currentUser.id];
  };

  // 1. Load persistent budget limits
  const loadBudgetLimits = async (userBudget) => {
    try {
      const storedLimits = await AsyncStorage.getItem(`userBudgetLimits_${currentUser.id}`);
      if (storedLimits) {
        const limits = JSON.parse(storedLimits);
        userBudget.today.total = limits.today || 0;
        userBudget.week.total = limits.week || 0;
        userBudget.month.total = limits.month || 0;
      }
    } catch (e) {
      console.error("Failed to load budget limits:", e);
    }
  };

  const loadData = async () => {
    if (!currentUser) return;

    const userBudget = ensureUserBudgetStructure();
    
    await loadBudgetLimits(userBudget); 

    // Load Expenses to calculate spending
    try {
        const storedExpenses = await AsyncStorage.getItem(`expenses_${currentUser.id}`);
        const localExpenses = storedExpenses ? JSON.parse(storedExpenses) : [];
        
        // Sort expenses by date (Newest first) for the "Recent Expenses" list
        const sortedExpenses = localExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        setExpenses(sortedExpenses);

        const activeExpenses = localExpenses.filter(exp => !exp.archived) || [];
        
        // Calculate spent per period
        // Note: uses amountPHP if conversion happened, otherwise amount
        const spentByPeriod = {
            today: activeExpenses.filter(exp => exp.period === 'today').reduce((sum, exp) => sum + (exp.amountPHP || exp.amount), 0),
            week: activeExpenses.filter(exp => exp.period === 'week').reduce((sum, exp) => sum + (exp.amountPHP || exp.amount), 0),
            month: activeExpenses.filter(exp => exp.period === 'month').reduce((sum, exp) => sum + (exp.amountPHP || exp.amount), 0),
        };
        
        // Calculate spent per category
        const spentByCategory = {};
        activeExpenses.forEach(exp => {
            if (!spentByCategory[exp.category]) {
            spentByCategory[exp.category] = 0;
            }
            spentByCategory[exp.category] += (exp.amountPHP || exp.amount);
        });
        
        if (userBudget) {
            userBudget.today.spent = spentByPeriod.today;
            userBudget.week.spent = spentByPeriod.week;
            userBudget.month.spent = spentByPeriod.month;
            
            setBudgets({
                today: userBudget.today,
                week: userBudget.week,
                month: userBudget.month,
            });

            const savedCategories = userBudget.categories || {};
            if (Object.keys(savedCategories).length > 0) {
                const normalized = Object.fromEntries(
                Object.entries(savedCategories).map(([name, cat]) => {
                    const recalculatedSpent = spentByCategory[name] || 0;
                    if (userBudget.categories[name]) {
                        userBudget.categories[name].spent = recalculatedSpent;
                    }
                    
                    return [
                        name,
                        {
                            budget: typeof cat.budget === "number" ? cat.budget : typeof cat.total === "number" ? cat.total : 0,
                            spent: recalculatedSpent,
                            color: cat.color || pickColorForCategory(name, savedCategories),
                        },
                    ];
                })
                );
                setCategories(normalized);
            } else {
                setCategories(cloneCategoryTemplate(DEFAULT_CATEGORIES));
            }
        }
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const openBudgetModal = () => {
    const current = budgets[selectedPeriod]?.total;
    setBudgetAmount(
      typeof current === "number" && current > 0 ? current.toString() : ""
    );
    setShowBudgetModal(true);
  };

  const handleSetBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    // Save persistent limit
    try {
        const storedLimits = await AsyncStorage.getItem(`userBudgetLimits_${currentUser.id}`);
        const limits = storedLimits ? JSON.parse(storedLimits) : { today: 0, week: 0, month: 0 };
        limits[selectedPeriod] = amount;
        await AsyncStorage.setItem(`userBudgetLimits_${currentUser.id}`, JSON.stringify(limits));
    } catch (e) {
        console.error("Failed to save budget limit:", e);
    }
    
    const updatedBudgets = {
      ...budgets,
      [selectedPeriod]: {
        ...budgets[selectedPeriod],
        total: amount,
      },
    };
    setBudgets(updatedBudgets);

    const userBudget = ensureUserBudgetStructure();
    if (userBudget) {
      userBudget[selectedPeriod].total = amount;
    }
    
    setShowBudgetModal(false);
    setBudgetAmount("");
    Alert.alert("Budget updated", `Set ${selectedPeriod} budget to ${currency} ${amount.toFixed(2)}`);
  };

  const deleteCategory = (name) => {
    Alert.alert("Confirm", `Delete category "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const updated = { ...categories };
          delete updated[name];
          setCategories(updated);
          if (currentUser && mockBudgets[currentUser.id]?.categories) {
            delete mockBudgets[currentUser.id].categories[name];
          }
        },
      },
    ]);
  };

  const addCategory = () => {
    setNewCategoryName("");
    setShowCreateCategoryModal(true);
  };

  const handleCreateCategory = () => {
    const name = (newCategoryName || "").trim();
    if (!name) {
      Alert.alert("Invalid", "Please enter a category name");
      return;
    }
    if (categories[name]) {
      Alert.alert("Exists", "Category already exists");
      return;
    }

    const color = pickColorForCategory(name, categories);
    const updated = { ...categories };
    updated[name] = { budget: 0, spent: 0, color };
    setCategories(updated);

    if (currentUser) {
      const userBudget = ensureUserBudgetStructure();
      if (userBudget?.categories) {
        userBudget.categories[name] = { budget: 0, spent: 0, color };
      }
    }

    setShowCreateCategoryModal(false);
    setNewCategoryName("");
    Alert.alert("Category added", `${name} is ready for tracking.`);
  };

  // 2. Logic to Save Leftover and Reset Budget
  const handleSaveToSavings = async () => {
    if (!currentUser) return;

    const currentTotal = budgets[selectedPeriod]?.total || 0;
    const currentSpent = budgets[selectedPeriod]?.spent || 0;
    const leftover = currentTotal - currentSpent;
    
    if (leftover > 0) {
      try {
          // A. Archive Expenses (Clear Spent)
          const storedExpenses = await AsyncStorage.getItem(`expenses_${currentUser.uid}`);
          let localExpenses = storedExpenses ? JSON.parse(storedExpenses) : [];

          const updatedExpenses = localExpenses.map(exp => {
              if (exp.period === selectedPeriod && !exp.archived) {
                  return { 
                      ...exp, 
                      archived: true, 
                      archiveDate: new Date().toISOString() 
                  };
              }
              return exp;
          });
          await AsyncStorage.setItem(`expenses_${currentUser.id}`, JSON.stringify(updatedExpenses));

          // B. Reset Budget Limit to 0
          const storedLimits = await AsyncStorage.getItem(`userBudgetLimits_${currentUser.uid}`);
          const limits = storedLimits ? JSON.parse(storedLimits) : { today: 0, week: 0, month: 0 };
          limits[selectedPeriod] = 0;
          await AsyncStorage.setItem(`userBudgetLimits_${currentUser.id}`, JSON.stringify(limits));
          
          // C. Add to Savings History (Persistence for Savings Screen)
          const storedSavings = await AsyncStorage.getItem(`savings_history_${currentUser.uid}`);
          const savingsHistory = storedSavings ? JSON.parse(storedSavings) : [];
          
          const newSavingEntry = {
            id: Date.now(),
            amount: leftover,
            title: `Saved from ${selectedPeriod} budget`,
            date: new Date().toISOString(),
            type: 'deposit'
          };
          
          savingsHistory.push(newSavingEntry);
          await AsyncStorage.setItem(`savings_history_${currentUser.uid}`, JSON.stringify(savingsHistory));

          // Reset local state immediately
          if (mockBudgets[currentUser.uid] && mockBudgets[currentUser.id][selectedPeriod]) {
              mockBudgets[currentUser.uid][selectedPeriod].spent = 0;
              mockBudgets[currentUser.uid][selectedPeriod].total = 0; 
          }

          // Reload Dashboard
          await loadData(); 

          Alert.alert(
            "Saved!",
            `${currency} ${leftover.toFixed(2)} saved from your ${selectedPeriod}budget!`,
            [
              {
                text: "View Savings",
                onPress: () => navigation.navigate("Savings"),
              },
              { text: "OK" },
            ]
          );

      } catch (error) {
          console.error("Failed to save savings:", error);
          Alert.alert("Error", "Failed to save savings data.");
      }
    } else {
      Alert.alert("No Savings", `No leftover budget to save from ${selectedPeriod}.`);
    }
  };

  const handleInviteCategory = (categoryName) => {
    if (!currentUser) {
      Alert.alert("Not signed in", "Please sign in to invite collaborators.");
      return;
    }
    const code = generateInviteCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    invitationCodes[code] = {
      ownerId: currentUser.id,
      category: categoryName,
      expiresAt,
      sharedWith: [],
    };

    Alert.alert(
      "Invite created",
      `Share this code to invite collaborators for ${categoryName}:\n\n${code}\n\nExpires in 5 minutes`,
      [{ text: "OK" }]
    );
  };

  const getCategoryIcon = (name, color) => {
    switch (name) {
      case "Food": return <Ionicons name="fast-food" color={color} size={20} />;
      case "Transportation": return <Ionicons name="car" color={color} size={20} />;
      case "Shopping": return <Ionicons name="cart" color={color} size={20} />;
      case "Bills": return <Ionicons name="receipt" color={color} size={20} />;
      default: return <Ionicons name="pricetag" color={color} size={20} />;
    }
  };

  // FIX: Welcome Message Logic
  // Check for username first, then full name, then 'User'
  const displayName = currentUser?.username || currentUser?.name || 'User';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: isDark ? "#2563EB" : "#3B82F6" }]}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{displayName}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity onPress={() => navigation.navigate("Savings")} style={{ marginRight: 16 }}>
              <MaterialIcons name="monetization-on" color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("CategoryCollaboration")} style={{ marginRight: 16 }}>
              <Ionicons name="people" color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
              <Ionicons name="settings-outline" color="#fff" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Budgets Overview */}
        <View style={styles.budgetContainer}>
          <View style={styles.periodTabs}>
            {["today", "week", "month"].map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setSelectedPeriod(p)}
                style={[
                  styles.periodButton,
                  { backgroundColor: selectedPeriod === p ? "#3B82F6" : "transparent" },
                ]}
              >
                <Text style={{
                    color: selectedPeriod === p ? "#fff" : "#3B82F6",
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget Summary Card */}
          <View style={[styles.budgetCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
            <Text style={[styles.budgetLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Total Budget
            </Text>
            <Text style={[styles.budgetValue, { color: isDark ? "#fff" : "#111" }]}>
              {currency} {budgets[selectedPeriod].total.toFixed(2)}
            </Text>

            <Text style={[styles.budgetLabel, { marginTop: 8, color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Spent
            </Text>
            <Text style={[styles.spentValue, { color: "#ef4444" }]}>
              -{currency} {budgets[selectedPeriod].spent.toFixed(2)}
            </Text>

            <Text style={[styles.remainingLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Remaining
            </Text>
            <Text style={[styles.remainingValue, { color: (budgets[selectedPeriod].total - budgets[selectedPeriod].spent) >= 0 ? (isDark ? "#fff" : "#111") : "#ef4444" }]}>
              {currency}{" "}
              {(budgets[selectedPeriod].total - budgets[selectedPeriod].spent).toFixed(2)}
            </Text>

            <View style={styles.budgetActions}>
              <TouchableOpacity onPress={openBudgetModal} style={[styles.setBudgetButton, { flex: 1 }]}>
                <Feather name="edit-2" color="#fff" size={16} />
                <Text style={styles.setBudgetText}>Set Budget</Text>
              </TouchableOpacity>
              {(budgets[selectedPeriod].total - budgets[selectedPeriod].spent) > 0 && (
                <TouchableOpacity 
                  onPress={handleSaveToSavings} 
                  style={[styles.savingsButton, { flex: 1 }]}
                >
                  <MaterialIcons name="savings" color="#fff" size={16} />
                  <Text style={styles.savingsButtonText}>Save Leftover</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Currency Rate Widget */}
        <View style={styles.section}>
          <CurrencyRateWidget theme={theme} />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDark ? "#fff" : "#111" }]}>
              Categories
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={addCategory}>
              <Feather name="plus" color="#fff" size={18} />
            </TouchableOpacity>
          </View>

          <View style={styles.categoryGrid}>
            {Object.entries(categories).map(([name, data]) => (
              <TouchableOpacity
                key={name}
                style={[styles.categoryCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}
                onPress={() => navigation.navigate('CategoryDetail', { categoryName: name, categoryData: data })}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, { backgroundColor: data.color + "30" }]}>
                  {getCategoryIcon(name, data.color)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.categoryName, { color: isDark ? "#fff" : "#111" }]}>
                    {name}
                  </Text>
                  <Text style={[styles.categorySpent, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                    {currency} {data.spent.toFixed(2)} / {currency} {data.budget.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    deleteCategory(name);
                  }}
                  style={styles.deleteButton}
                >
                  <Feather name="trash-2" color="#ef4444" size={18} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Expenses - Now using live sorted 'expenses' state */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDark ? "#fff" : "#111" }]}>
            Recent Expenses
          </Text>
          {expenses.length === 0 ? (
            <Text style={{ color: isDark ? "#9ca3af" : "#6b7280", marginTop: 8 }}>
              No expenses yet
            </Text>
          ) : (
            expenses
              .slice(0, 5)
              .map((exp) => (
                <View key={exp.id} style={[styles.expenseCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
                  <View>
                    <Text style={[styles.expenseCategory, { color: isDark ? "#fff" : "#111" }]}>
                      {exp.category}
                    </Text>
                    <Text style={{color: isDark ? "#9ca3af" : "#6b7280", fontSize: 12}}>
                      {new Date(exp.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View>
                      <Text style={[styles.expenseAmount, { color: "#ef4444" }]}>
                        -{currency} {(exp.amountPHP || exp.amount).toFixed(2)}
                      </Text>
                      {/* Show original currency if converted */}
                      {exp.amountPHP && exp.currency !== 'PHP' && (
                          <Text style={{fontSize: 10, color: isDark ? "#6b7280" : "#9ca3af", textAlign: 'right'}}>
                              ({exp.currency} {exp.amount.toFixed(2)})
                          </Text>
                      )}
                  </View>
                </View>
              ))
          )}
        </View>

      </ScrollView>

      {/* Budget Modal */}
      {showBudgetModal && (
        <Modal title={`Set ${selectedPeriod} Budget`} appContext={appContext} onClose={() => setShowBudgetModal(false)}>
          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16, marginBottom: 8, fontWeight: "500" }}>
              Enter new budget for {selectedPeriod}
            </Text>
            <TextInput
              placeholder={`Enter ${selectedPeriod} budget`}
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              keyboardType="numeric"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              style={[styles.inputField, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]}
            />
          </View>
          <TouchableOpacity style={styles.modalSaveButton} onPress={handleSetBudget}>
            <Text style={styles.modalSaveText}>Save Budget</Text>
          </TouchableOpacity>
        </Modal>
      )}
      
      {/* Create Category Modal */}
      {showCreateCategoryModal && (
        <Modal title="Create Category" appContext={appContext} onClose={() => setShowCreateCategoryModal(false)}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8, color: isDark ? "#fff" : "#111" }}>
              Category name
            </Text>
            <TextInput
              placeholder="e.g. Groceries"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={[styles.inputField, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]}
            />
          </View>
          <TouchableOpacity style={styles.modalSaveButton} onPress={handleCreateCategory}>
            <Text style={styles.modalSaveText}>Create</Text>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  welcomeText: { color: "#DBEAFE", fontSize: 14 },
  userName: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  budgetContainer: { padding: 20 },
  periodTabs: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  periodButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: "#3B82F6" },
  budgetCard: { borderRadius: 16, padding: 20, elevation: 2 },
  budgetLabel: { fontSize: 14, fontWeight: "500" },
  budgetValue: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  spentValue: { fontSize: 18, fontWeight: "600" },
  remainingLabel: { fontSize: 13, marginTop: 6 },
  remainingValue: { fontSize: 20, fontWeight: "700" },
  budgetActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  setBudgetButton: { backgroundColor: "#3B82F6", flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 12, borderRadius: 10, gap: 6 },
  setBudgetText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  savingsButton: { backgroundColor: "#10b981", flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 12, borderRadius: 10, gap: 6 },
  savingsButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  addButton: { backgroundColor: "#3B82F6", padding: 10, borderRadius: 10 },
  categoryGrid: { gap: 12 },
  categoryCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 12, marginBottom: 8, elevation: 1 },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 10 },
  categoryName: { fontSize: 16, fontWeight: "600" },
  categorySpent: { fontSize: 13 },
  deleteButton: { padding: 4 },
  expenseCard: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 12, marginTop: 6 },
  expenseCategory: { fontSize: 15, fontWeight: "500" },
  expenseAmount: { fontSize: 15, fontWeight: "700" },
  modalSaveButton: { backgroundColor: "#3B82F6", paddingVertical: 14, borderRadius: 12 },
  modalSaveText: { color: "#fff", fontSize: 16, textAlign: "center", fontWeight: "600" },
  inputField: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, fontSize: 16 },
});