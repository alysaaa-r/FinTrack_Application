// screens/SharedGoalsScreen.js
import React, { useState, useEffect } from "react";
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
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
// Ensure mockSharedGoalCategories is available
import { invitationCodes, mockSharedGoalCategories } from "../utils/mockData"; 
import apiService from "../services/api";
import Modal from "../components/Modal";
import api from "../services/api";

export default function SharedGoalsScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const currency = appContext?.currency || "PHP";
  const currentUser = appContext?.currentUser || null;
  const isDark = theme === "dark";

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoriesWithGoals, setCategoriesWithGoals] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeType, setContributeType] = useState("add");
  const [contributeCurrency, setContributeCurrency] = useState(currency);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createCurrency, setCreateCurrency] = useState(currency);
  const [showCreateCurrencyDropdown, setShowCreateCurrencyDropdown] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [convertedAmount, setConvertedAmount] = useState("");

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

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Calculate exchange rate and converted amount when currency or amount changes
  useEffect(() => {
    const calculateConversion = async () => {
      if (!selectedGoal || !contributeAmount || !contributeCurrency) return;
      
      const amount = parseFloat(contributeAmount);
      if (isNaN(amount) || amount <= 0) {
        setConvertedAmount("");
        setExchangeRate(1);
        return;
      }

      const goalCurrency = selectedGoal.currency || currency;
      
      if (contributeCurrency === goalCurrency) {
        setConvertedAmount(amount.toFixed(2));
        setExchangeRate(1);
        return;
      }

      try {
        const result = await api.convertCurrency(amount, contributeCurrency, goalCurrency);
        setConvertedAmount(result.convertedAmount.toFixed(2));
        setExchangeRate(result.rate);
      } catch (error) {
        console.error("Conversion error:", error);
        setConvertedAmount("");
        setExchangeRate(1);
      }
    };

    calculateConversion();
  }, [contributeCurrency, contributeAmount, selectedGoal]);

  // --- Load data only from local storage (AsyncStorage) ---
  const loadData = async () => {
    if (!currentUser) return;

    try {
      const storedSharedGoals = await AsyncStorage.getItem(`sharedGoals_${currentUser.id}`);
      let localSharedGoals = storedSharedGoals ? JSON.parse(storedSharedGoals) : [];
      
      console.log('📱 Loaded shared goals from local backup:', localSharedGoals.length);
      
      // Group by categories and populate category data
      const categoryData = {};
      const budgetCategories = mockSharedGoalCategories[currentUser.id] || {};
      
      // Show ALL categories and filter goals for them
      Object.entries(budgetCategories).forEach(([categoryName, data]) => {
        const goalsForCategory = localSharedGoals.filter(g => g.category === categoryName);
        
        categoryData[categoryName] = {
          ...data,
          sharedGoals: goalsForCategory,
        };
      });
      
      setAllCategories(budgetCategories);
      setCategoriesWithGoals(categoryData);
      
      if (localSharedGoals.length === 0 && Object.keys(budgetCategories).length === 0) {
        console.log('📱 No shared goals data available - starting fresh');
      }
      
    } catch (localError) {
      console.error('❌ Local backup load failed:', localError);
      setAllCategories({});
      setCategoriesWithGoals({});
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert("Invalid", "Please enter a category name");
      return;
    }

    const categoryName = newCategoryName.trim();

    if (!mockSharedGoalCategories[currentUser.id]) {
      mockSharedGoalCategories[currentUser.id] = {};
    }

    if (mockSharedGoalCategories[currentUser.id][categoryName]) {
      Alert.alert("Exists", "This category already exists");
      return;
    }

    const CATEGORY_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
    const CATEGORY_ICONS = ["tag", "shopping-bag", "home", "coffee", "gift", "heart"];
    const existingCount = Object.keys(mockSharedGoalCategories[currentUser.id]).length;
    const color = CATEGORY_COLORS[existingCount % CATEGORY_COLORS.length];
    const icon = CATEGORY_ICONS[existingCount % CATEGORY_ICONS.length];

    mockSharedGoalCategories[currentUser.id][categoryName] = {
      budget: 0,
      total: 0,
      spent: 0,
      color: color,
      icon: icon,
    };

    loadData();
    setShowCreateCategoryModal(false);
    setNewCategoryName("");
    setShowCategoryModal(true);
    Alert.alert("Success", `Category "${categoryName}" created! Now select it to create your goal.`);
  };

  // --- Create goal saves locally (to AsyncStorage) ---
  const handleCreate = async () => {
    if (!selectedCategory || !goalTitle.trim() || !goalAmount.trim()) {
      Alert.alert("Invalid", "Please enter goal title and amount");
      return;
    }

    const amount = parseFloat(goalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    const newGoal = {
      id: Date.now(), // Generate unique local ID
      userId: currentUser.id,
      category: selectedCategory,
      title: goalTitle.trim(),
      targetAmount: amount,
      currentAmount: 0,
      currency: createCurrency,
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      sharedWith: [],
      contributions: [],
      createdAt: new Date().toISOString(),
      isPersonal: false,
    };

    try {
      console.log('💾 Shared goal created locally.');
      
      const storedSharedGoals = await AsyncStorage.getItem(`sharedGoals_${currentUser.id}`);
      const localSharedGoals = storedSharedGoals ? JSON.parse(storedSharedGoals) : [];
      
      // Add new goal to the beginning of the list
      localSharedGoals.unshift(newGoal);
      await AsyncStorage.setItem(`sharedGoals_${currentUser.id}`, JSON.stringify(localSharedGoals));
      
      Alert.alert("Success", "Shared goal created and saved locally.");
      
    } catch (localError) {
      console.error('❌ Local save failed:', localError);
      Alert.alert("Error", "Failed to create shared goal. Please try again.");
      return;
    }
    
    await loadData(); // Reload to show updated data
    setShowCreateModal(false);
    setSelectedCategory(null);
    setGoalTitle("");
    setGoalAmount("");
    setCreateCurrency(currency);
    setShowCreateCurrencyDropdown(false);
  };

  // --- Handle contribution only saves locally ---
  const handleContribute = async () => {
    if (!contributeAmount.trim()) {
      Alert.alert("Invalid", "Please enter an amount");
      return;
    }

    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    const goalCurrency = selectedGoal.currency || currency;
    let amountInGoalCurrency = amount;
    let currentExchangeRate = 1;

    // Convert to goal's currency if different
    if (contributeCurrency !== goalCurrency) {
      try {
        const conversionResult = await api.convertCurrency(amount, contributeCurrency, goalCurrency);
        amountInGoalCurrency = conversionResult.convertedAmount;
        currentExchangeRate = conversionResult.rate;
      } catch (error) {
        setIsLoading(false);
        Alert.alert("Error", "Failed to convert currency. Please try again.");
        return;
      }
    }

    const contribution = {
      id: Date.now() + Math.random(), // Unique ID for contribution
      userId: currentUser.id,
      userName: currentUser.name, // NOTE: Assuming currentUser.name is available
      amount: amount,
      amountInGoalCurrency: amountInGoalCurrency,
      currency: contributeCurrency,
      exchangeRate: currentExchangeRate,
      type: contributeType,
      date: new Date().toISOString(),
    };

    try {
      const storedSharedGoals = await AsyncStorage.getItem(`sharedGoals_${currentUser.id}`);
      const localSharedGoals = storedGoals ? JSON.parse(storedGoals) : [];
      
      const goalIndex = localSharedGoals.findIndex(g => g.id === selectedGoal.id);
      if (goalIndex !== -1) {
        // Ensure contributions array exists
        if (!localSharedGoals[goalIndex].contributions) {
            localSharedGoals[goalIndex].contributions = [];
        }
        
        localSharedGoals[goalIndex].contributions.push(contribution);
        
        if (contributeType === "add") {
          localSharedGoals[goalIndex].currentAmount += amountInGoalCurrency;
        } else {
          localSharedGoals[goalIndex].currentAmount = Math.max(0, localSharedGoals[goalIndex].currentAmount - amountInGoalCurrency);
        }
        
        await AsyncStorage.setItem(`sharedGoals_${currentUser.id}`, JSON.stringify(localSharedGoals));
        
        const conversionMessage = contributeCurrency !== goalCurrency 
          ? `\n\nConverted: ${amount} ${contributeCurrency} → ${amountInGoalCurrency.toFixed(2)} ${goalCurrency}`
          : "";
          
        Alert.alert("Success", 
          `${goalCurrency} ${amountInGoalCurrency.toFixed(2)} ${contributeType === "add" ? "added to" : "spent from"} goal locally!${conversionMessage}`
        );
      } else {
          throw new Error('Shared Goal not found locally.');
      }
    } catch (localError) {
      console.error('❌ Local contribution save failed:', localError);
      Alert.alert("Error", "Failed to save contribution. Please try again.");
    }

    await loadData(); // Reload to show updated data
    setIsLoading(false);
    setShowContributeModal(false);
    setContributeAmount("");
    setContributeCurrency(currency);
    setShowCurrencyDropdown(false);
    setConvertedAmount("");
    setExchangeRate(1);
    setSelectedGoal(null);
  };

  const handleGenerateInvite = async (goal) => {
    if (goal.ownerId !== currentUser.id) {
      Alert.alert("Error", "Only the owner can create invite codes");
      return;
    }

    try {
      console.log('🎯 Creating invitation for shared goal:', goal.id);
      
      const response = await apiService.createInvitation('goal', goal.id, 30); // 30 minutes
      
      console.log('✅ Invitation created:', response);
      
      Alert.alert(
        "✅ Real Invitation Created!",
        `Share this code with others: ${response.invitation.code}\n\n⏰ Expires: ${new Date(response.invitation.expiresAt).toLocaleString()}\n\n🔗 Other users can join your goal with this code!`,
        [
          { text: "Copy Code", onPress: () => {
            // Add clipboard copy functionality here if available
            console.log('Code to share:', response.invitation.code);
          }},
          { text: "OK" }
        ]
      );
    } catch (error) {
      console.error('❌ Error creating invitation:', error);
      Alert.alert(
        "Error", 
        "Failed to create invitation. Please try again."
      );
    }
  };

  // --- Delete goal only deletes locally ---
  const handleDelete = (goal) => {
    if (goal.ownerId !== currentUser.id) {
      Alert.alert("Error", "Only the owner can delete this");
      return;
    }

    Alert.alert("Confirm", "Delete this shared goal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            console.log('🗑️ Deleting shared goal locally:', goal.id);
            const storedSharedGoals = await AsyncStorage.getItem(`sharedGoals_${currentUser.id}`);
            const localSharedGoals = storedSharedGoals ? JSON.parse(storedSharedGoals) : [];
            
            const filteredGoals = localSharedGoals.filter(g => g.id !== goal.id);
            await AsyncStorage.setItem(`sharedGoals_${currentUser.id}`, JSON.stringify(filteredGoals));
            
            Alert.alert("Deleted", "Shared goal has been deleted successfully.");
            
          } catch (localError) {
            console.error('❌ Local deletion failed:', localError);
            Alert.alert("Error", "Failed to delete shared goal. Please try again.");
            return;
          }
          
          await loadData(); // Reload to show updated list
        },
      },
    ]);
  };

  const getUserColor = (userId) => {
    const colors = ["#3B82F6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
    // Simple hash function for color assignment
    const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // NOTE: This render function is only kept as a helper; it is NOT called in the main return loop.
  const renderSharedGoal = (goal) => {
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const isOwner = goal.ownerId === currentUser.id;

    return (
      <View
        key={goal.id}
        style={[
          styles.goalCard,
          {
            backgroundColor: isDark ? "#1f2937" : "#fff",
            borderLeftWidth: 4,
            borderLeftColor: "#3B82F6",
          },
        ]}
      >
        <View style={styles.goalHeader}>
          <Text style={[styles.goalTitle, { color: isDark ? "#fff" : "#111" }]}>
            {goal.title}
          </Text>
          {isOwner && (
            <TouchableOpacity onPress={() => handleDelete(goal)}>
              <Feather name="trash-2" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.itemOwnerText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          Owner: {goal.ownerName} {isOwner && "(You)"}
        </Text>

        {goal.sharedWith && goal.sharedWith.length > 0 && (
          <Text style={[styles.itemOwnerText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Shared with {goal.sharedWith.length} {goal.sharedWith.length === 1 ? "person" : "people"}
          </Text>
        )}

        <Text style={[styles.goalAmount, { color: isDark ? "#9ca3af" : "#6b7280", marginTop: 8 }]}>
          {goal.currency || currency} {goal.currentAmount?.toFixed(2) || "0.00"} / {goal.currency || currency} {goal.targetAmount?.toFixed(2) || "0.00"}
        </Text>

        <View style={[styles.progressBar, { backgroundColor: isDark ? "#374151" : "#e5e7eb", marginTop: 8 }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: "#3B82F6",
              },
            ]}
          />
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#10b981" }]}
            onPress={() => {
              setSelectedGoal(goal);
              setContributeType("add");
              setContributeCurrency(currency);
              setShowCurrencyDropdown(false);
              setConvertedAmount("");
              setExchangeRate(1);
              setShowContributeModal(true);
            }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Add</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#f59e0b" }]}
            onPress={() => {
              setSelectedGoal(goal);
              setContributeType("expense");
              setContributeCurrency(currency);
              setShowCurrencyDropdown(false);
              setConvertedAmount("");
              setExchangeRate(1);
              setShowContributeModal(true);
            }}
          >
            <Feather name="minus" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Spend</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#3B82F6" }]}
            onPress={() => handleGenerateInvite(goal)}
          >
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Invite</Text>
          </TouchableOpacity>
        </View>

        {goal.contributions && goal.contributions.length > 0 && (
          <View style={[styles.contributionsList, { borderTopColor: isDark ? "#374151" : "#e5e7eb" }]}>
            <Text style={[styles.contributionsTitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Recent Activity
            </Text>
            {goal.contributions.slice(-3).reverse().map((contrib, idx) => (
              <View key={idx} style={styles.contributionItem}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <View
                    style={[
                      styles.userColorIndicator,
                      { backgroundColor: getUserColor(contrib.userId) },
                    ]}
                  />
                  <View style={styles.contributionLeft}>
                    <Text style={[styles.contributorName, { color: isDark ? "#fff" : "#111" }]}>
                      {contrib.userName}
                    </Text>
                    <Text style={[styles.contributionDate, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
                      {new Date(contrib.date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.contributionAmount,
                    {
                      color: contrib.type === "add" ? "#10b981" : "#ef4444",
                    },
                  ]}
                >
                  {contrib.type === "add" ? "+" : "-"}{currency} {contrib.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f3f4f6" }]}>
      <View style={[styles.header, { backgroundColor: isDark ? "#1f2937" : "#3B82F6" }]}>
        <TouchableOpacity onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Dashboard');
          }
        }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Goals</Text>
        <TouchableOpacity onPress={() => setShowCategoryModal(true)}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.section}>
          <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
            <Text style={[styles.summaryTitle, { color: isDark ? "#fff" : "#111" }]}>
              Shared Goals
            </Text>
            <Text style={[styles.summarySubtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Collaborate with others on savings goals
            </Text>
          </View>
        </View>

        {Object.keys(categoriesWithGoals).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="target" size={64} color={isDark ? "#374151" : "#d1d5db"} />
            <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              No categories yet
            </Text>
            <Text style={[styles.emptyHint, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
              Tap the + button to create a category
            </Text>
          </View>
        ) : (
          Object.entries(categoriesWithGoals).map(([categoryName, data]) => (
            <View key={categoryName} style={styles.section}>
              <TouchableOpacity
                style={[
                  styles.categoryHeaderCard,
                  { backgroundColor: isDark ? "#1f2937" : "#fff" },
                ]}
                onPress={() => {
                  // Navigate to a dedicated screen to view goals
                  navigation.navigate("CategoryGoals", {
                    categoryName,
                    categoryData: data,
                    isSharedView: true,
                    // PASS THE CURRENT, UP-TO-DATE LIST OF GOALS FOR THIS CATEGORY
                    categoryGoals: data.sharedGoals,
                  });
                }}
              >
                <View style={styles.categoryHeaderContent}>
                  <View
                    style={[
                      styles.categoryIconLarge,
                      { backgroundColor: data.color + "20" },
                    ]}
                  >
                    <Feather name={data.icon} size={28} color={data.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text
                      style={[
                        styles.categoryNameLarge,
                        { color: isDark ? "#fff" : "#111" },
                      ]}
                    >
                      {categoryName}
                    </Text>
                    <Text
                      style={[
                        styles.categoryGoalsCount,
                        { color: isDark ? "#9ca3af" : "#6b7280" },
                      ]}
                    >
                      {data.sharedGoals?.length || 0} shared {data.sharedGoals?.length === 1 ? "goal" : "goals"}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.categoryActionBtn, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}
                      onPress={() => {
                        const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                        Alert.alert(
                          "Category Invite",
                          `Share this mock code for others to access "${categoryName}" category:\n\n${mockCode}\n\n(Cloud invite logic removed)`,
                          [{ text: "OK" }]
                        );
                      }}
                    >
                      <Feather name="user-plus" size={20} color={isDark ? "#fff" : "#111"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.categoryActionBtn, { backgroundColor: "#3B82F6" }]}
                      onPress={() => {
                        setSelectedCategory(categoryName);
                        setShowCreateModal(true);
                      }}
                    >
                      <Feather name="plus" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
              
              {/* --- NO INLINE GOAL RENDERING --- */}
            
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Goal Modal */}
      {showCreateModal && (
        <Modal
          title="Create Shared Goal"
          appContext={appContext}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedCategory(null);
            setGoalTitle("");
            setGoalAmount("");
          }}
        >
          <View>
            {selectedCategory && (
              <Text
                style={{
                  color: isDark ? "#3B82F6" : "#2563EB",
                  fontSize: 14,
                  marginBottom: 12,
                  fontWeight: "600",
                }}
              >
                Category: {selectedCategory}
              </Text>
            )}
            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              Goal Title
            </Text>
            <TextInput
              placeholder="e.g. Save for vacation"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              value={goalTitle}
              onChangeText={setGoalTitle}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  color: isDark ? "#fff" : "#111",
                },
              ]}
            />

            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginTop: 16,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              Currency
            </Text>
            <TouchableOpacity
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                },
              ]}
              onPress={() => setShowCreateCurrencyDropdown(!showCreateCurrencyDropdown)}
            >
              <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16 }}>
                {(() => {
                  const selectedCurrency = currencies.find(curr => curr.code === createCurrency);
                  return selectedCurrency ? `${selectedCurrency.symbol} ${selectedCurrency.code}` : createCurrency;
                })()}
              </Text>
              <Feather name="chevron-down" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
            </TouchableOpacity>

            {showCreateCurrencyDropdown && (
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#fff",
                    borderColor: isDark ? "#374151" : "#e5e7eb",
                    marginBottom: 16,
                  },
                ]}
              >
                <ScrollView style={{ maxHeight: 200 }}>
                  {currencies.map((curr) => (
                    <TouchableOpacity
                      key={curr.code}
                      style={[
                        styles.dropdownItem,
                        createCurrency === curr.code && {
                          backgroundColor: isDark ? "#374151" : "#e5e7eb",
                        },
                      ]}
                      onPress={() => {
                        setCreateCurrency(curr.code);
                        setShowCreateCurrencyDropdown(false);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View>
                          <Text
                            style={[
                              styles.dropdownItemText,
                              { color: isDark ? "#fff" : "#111", fontWeight: "600" },
                            ]}
                          >
                            {curr.symbol} {curr.code}
                          </Text>
                          <Text
                            style={{
                              color: isDark ? "#9ca3af" : "#6b7280",
                              fontSize: 14,
                              marginTop: 2,
                            }}
                          >
                            {curr.name}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              Target Amount
            </Text>
            <TextInput
              placeholder="Enter target amount"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              keyboardType="numeric"
              value={goalAmount}
              onChangeText={setGoalAmount}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  color: isDark ? "#fff" : "#111",
                },
              ]}
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleCreate}>
              <Text style={styles.modalButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Contribute Modal */}
      {showContributeModal && selectedGoal && (
        <Modal
          title={`${contributeType === "add" ? "Add to" : "Spend from"} Goal`}
          appContext={appContext}
          onClose={() => {
            setShowContributeModal(false);
            setSelectedGoal(null);
            setContributeAmount("");
            setContributeType("add");
            setContributeCurrency(currency);
            setShowCurrencyDropdown(false);
            setConvertedAmount("");
            setExchangeRate(1);
          }}
        >
          <View>
            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 12,
                fontWeight: "600",
              }}
            >
              {selectedGoal.title}
            </Text>
            <Text
              style={{
                color: isDark ? "#9ca3af" : "#6b7280",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Current: {selectedGoal.currency || currency} {selectedGoal.currentAmount?.toFixed(2) || "0.00"} / {selectedGoal.currency || currency} {selectedGoal.targetAmount?.toFixed(2) || "0.00"}
            </Text>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                style={[
                  styles.contributeTypeButton,
                  {
                    backgroundColor: contributeType === "add" ? (isDark ? "#3B82F6" : "#2563EB") : (isDark ? "#374151" : "#e5e7eb"),
                    flex: 1,
                  },
                ]}
                onPress={() => setContributeType("add")}
              >
                <Text
                  style={{
                    color: contributeType === "add" ? "#fff" : (isDark ? "#9ca3af" : "#6b7280"),
                    fontWeight: "600",
                  }}
                >
                  Add Money
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.contributeTypeButton,
                  {
                    backgroundColor: contributeType === "expense" ? (isDark ? "#3B82F6" : "#2563EB") : (isDark ? "#374151" : "#e5e7eb"),
                    flex: 1,
                  },
                ]}
                onPress={() => setContributeType("expense")}
              >
                <Text
                  style={{
                    color: contributeType === "expense" ? "#fff" : (isDark ? "#9ca3af" : "#6b7280"),
                    fontWeight: "600",
                  }}
                >
                  Spend
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              Currency
            </Text>
            <TouchableOpacity
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                },
              ]}
              onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
            >
              <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16 }}>
                {(() => {
                  const selectedCurrency = currencies.find(curr => curr.code === contributeCurrency);
                  return selectedCurrency ? `${selectedCurrency.symbol} ${selectedCurrency.code}` : contributeCurrency;
                })()}
              </Text>
              <Feather name="chevron-down" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
            </TouchableOpacity>

            {showCurrencyDropdown && (
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#fff",
                    borderColor: isDark ? "#374151" : "#e5e7eb",
                  },
                ]}
              >
                <ScrollView style={{ maxHeight: 200 }}>
                  {currencies.map((curr) => (
                    <TouchableOpacity
                      key={curr.code}
                      style={[
                        styles.dropdownItem,
                        contributeCurrency === curr.code && {
                          backgroundColor: isDark ? "#374151" : "#e5e7eb",
                        },
                      ]}
                      onPress={() => {
                        setContributeCurrency(curr.code);
                        setShowCurrencyDropdown(false);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View>
                          <Text
                            style={[
                              styles.dropdownItemText,
                              { color: isDark ? "#fff" : "#111", fontWeight: "600" },
                            ]}
                          >
                            {curr.symbol} {curr.code}
                          </Text>
                          <Text
                            style={{
                              color: isDark ? "#9ca3af" : "#6b7280",
                              fontSize: 14,
                              marginTop: 2,
                            }}
                          >
                            {curr.name}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              Amount
            </Text>
            <TextInput
              placeholder="Enter amount"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              keyboardType="numeric"
              value={contributeAmount}
              onChangeText={setContributeAmount}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  color: isDark ? "#fff" : "#111",
                },
              ]}
            />

            {convertedAmount && contributeCurrency !== (selectedGoal.currency || currency) && (
              <View
                style={{
                  backgroundColor: isDark ? "#1e3a5f" : "#dbeafe",
                  padding: 12,
                  borderRadius: 8,
                  marginTop: 12,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: isDark ? "#93c5fd" : "#1e40af",
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 4,
                  }}
                >
                  💱 Currency Conversion
                </Text>
                <Text
                  style={{
                    color: isDark ? "#bfdbfe" : "#1e40af",
                    fontSize: 13,
                  }}
                >
                  {contributeAmount} {contributeCurrency} = {convertedAmount} {selectedGoal.currency || currency}
                </Text>
                <Text
                  style={{
                    color: isDark ? "#9ca3af" : "#6b7280",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Exchange rate: 1 {contributeCurrency} = {exchangeRate.toFixed(4)} {selectedGoal.currency || currency}
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.modalButton, { opacity: isLoading ? 0.6 : 1 }]} onPress={handleContribute} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>
                  {contributeType === "add" ? "Add Money" : "Record Expense"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <Modal
          title="Select Category"
          appContext={appContext}
          onClose={() => setShowCategoryModal(false)}
        >
          <View>
            <Text
              style={{
                color: isDark ? "#9ca3af" : "#6b7280",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Choose a category for your shared goal
            </Text>
            
            {Object.keys(allCategories).length === 0 ? (
              <View>
                <Text style={{ color: isDark ? "#6b7280" : "#9ca3af", textAlign: "center", padding: 20, marginBottom: 16 }}>
                  No categories available yet.
                </Text>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#3B82F6" }]}
                  onPress={() => {
                    setShowCategoryModal(false);
                    setShowCreateCategoryModal(true);
                  }}
                >
                  <Text style={styles.modalButtonText}>Create Category</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {Object.entries(allCategories).map(([categoryName, data]) => (
                  <TouchableOpacity
                    key={categoryName}
                    style={[
                      styles.categorySelectButton,
                      { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }
                    ]}
                    onPress={() => {
                      setSelectedCategory(categoryName);
                      setShowCategoryModal(false);
                      setShowCreateModal(true);
                    }}
                  >
                    <View style={[styles.categorySelectIcon, { backgroundColor: data.color + "30" }]}>
                      <Feather name={data.icon || "tag"} size={24} color={data.color} />
                    </View>
                    <Text style={[styles.categorySelectText, { color: isDark ? "#fff" : "#111" }]}>
                      {categoryName}
                    </Text>
                    <Feather name="chevron-right" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.categorySelectButton,
                    { backgroundColor: isDark ? "#374151" : "#e5e7eb", marginTop: 8 }
                  ]}
                  onPress={() => {
                    setShowCategoryModal(false);
                    setShowCreateCategoryModal(true);
                  }}
                >
                  <View style={[styles.categorySelectIcon, { backgroundColor: "#3B82F6" + "30" }]}>
                    <Feather name="plus" size={24} color="#3B82F6" />
                  </View>
                  <Text style={[styles.categorySelectText, { color: isDark ? "#fff" : "#111" }]}>
                    Create New Category
                  </Text>
                  <Feather name="chevron-right" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Create Category Modal */}
      {showCreateCategoryModal && (
        <Modal
          title="Create Category"
          appContext={appContext}
          onClose={() => {
            setShowCreateCategoryModal(false);
            setNewCategoryName("");
          }}
        >
          <View>
            <Text
              style={{
                color: isDark ? "#9ca3af" : "#6b7280",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Create a new category for organizing your shared goals
            </Text>
            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              Category Name
            </Text>
            <TextInput
              placeholder="e.g. Vacation, Emergency Fund, Home"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                  color: isDark ? "#fff" : "#111",
                },
              ]}
            />
            <TouchableOpacity style={styles.modalButton} onPress={handleCreateCategory}>
              <Text style={styles.modalButtonText}>Create Category</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  emptyHint: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  categoryHeaderCard: {
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    marginBottom: 12,
  },
  categoryHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryNameLarge: {
    fontSize: 20,
    fontWeight: "700",
  },
  categoryGoalsCount: {
    fontSize: 14,
    marginTop: 4,
  },
  addGoalBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  goalCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  goalAmount: {
    fontSize: 14,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  itemOwnerText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  contributionsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  contributionsTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  contributionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  contributionLeft: {
    flex: 1,
  },
  contributorName: {
    fontSize: 14,
    fontWeight: "500",
  },
  contributionDate: {
    fontSize: 12,
    marginTop: 2,
    marginLeft: 20,
  },
  contributionAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  userColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  noGoalsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    elevation: 1,
    alignItems: "center",
  },
  noGoalsText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  modalButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  contributeTypeButton: {
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  categorySelectButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  categorySelectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  categorySelectText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  categoryActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
});