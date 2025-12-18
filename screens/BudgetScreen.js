// screens/BudgetScreen.js - Personal Goals Screen
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  RefreshControl,
} from "react-native";
import Modal from "../components/Modal";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import api from "../services/api"; // <--- FIXED IMPORT: Uses your new api.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BudgetScreen({ appContext }) {
  const theme = appContext?.theme || "light";
  const currentUser = appContext?.currentUser || null;
  const currency = appContext?.currency || "PHP";
  const isDark = theme === "dark";

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

  const [personalGoals, setPersonalGoals] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetCurrency, setTargetCurrency] = useState(currency);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeCurrency, setContributeCurrency] = useState(currency);
  const [contributeType, setContributeType] = useState("add"); 
  const [refreshing, setRefreshing] = useState(false);
  const [showTargetCurrencyDropdown, setShowTargetCurrencyDropdown] = useState(false);
  const [showContributeCurrencyDropdown, setShowContributeCurrencyDropdown] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyGoal, setHistoryGoal] = useState(null);
  const [convertedAmount, setConvertedAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadGoals();
    }
  }, [currentUser]);

  // Currency conversion effect for real-time preview
  useEffect(() => {
    if (!contributeAmount || !selectedGoal || isNaN(parseFloat(contributeAmount))) {
      setConvertedAmount("");
      setExchangeRate(1);
      return;
    }

    const calculateConversion = async () => {
      const amount = parseFloat(contributeAmount);
      const goalCurrency = selectedGoal.currency || currency;
      
      if (contributeCurrency === goalCurrency) {
        setConvertedAmount(amount.toFixed(2));
        setExchangeRate(1);
        return;
      }

      try {
        const result = await api.convertCurrency(amount, contributeCurrency, goalCurrency);
        if (result && result.convertedAmount) {
             setConvertedAmount(result.convertedAmount.toFixed(2));
             setExchangeRate(result.rate);
        }
      } catch (error) {
        console.warn("Preview conversion failed", error.message);
        // Fallback handled in api.js, but we reset here to be safe
      }
    };

    calculateConversion();
  }, [contributeCurrency, contributeAmount, selectedGoal]);

  const loadGoals = async () => {
    if (!currentUser) return;
    await loadGoalsFromLocal();
  };

  const loadGoalsFromLocal = async () => {
    try {
      const localGoals = await AsyncStorage.getItem(`personalGoals_${currentUser.id}`);
      if (localGoals) {
        const goals = JSON.parse(localGoals);
        setPersonalGoals(goals);
      } else {
        setPersonalGoals([]);
      }
    } catch (error) {
      console.error('Error loading from local storage:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadGoals();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCreateGoal = async () => {
    if (!goalTitle.trim() || !targetAmount.trim()) {
      Alert.alert("Invalid", "Please enter goal title and target amount");
      return;
    }

    const amount = parseFloat(targetAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    
    const goalData = {
      id: Date.now(),
      userId: currentUser.id,
      createdBy: currentUser.id,
      title: goalTitle.trim(),
      targetAmount: amount,
      currency: targetCurrency,
      currentAmount: 0,
      isPersonal: true,
      contributions: [],
      createdAt: new Date().toISOString(),
      savedLocally: true 
    };

    try {
      await saveGoalLocally(goalData);
      setPersonalGoals(prev => [...prev, goalData]);
      Alert.alert("Success", "Personal goal created!");
      
    } catch (localError) {
      console.error('❌ Failed to create goal locally:', localError);
      Alert.alert("Error", "Failed to create goal. Please try again.");
    } finally {
      setIsLoading(false);
      setShowCreateModal(false);
      setGoalTitle("");
      setTargetAmount("");
      setTargetCurrency(currency);
      setShowTargetCurrencyDropdown(false);
    }
  };

  const saveGoalLocally = async (newGoal) => {
    try {
      const existingGoals = await AsyncStorage.getItem(`personalGoals_${currentUser.id}`);
      const goals = existingGoals ? JSON.parse(existingGoals) : [];
      
      const goalIndex = goals.findIndex(g => g.id === newGoal.id);
      if (goalIndex > -1) {
        goals[goalIndex] = newGoal; 
      } else {
        goals.push(newGoal); 
      }
      
      await AsyncStorage.setItem(`personalGoals_${currentUser.id}`, JSON.stringify(goals));
    } catch (error) {
      console.error('Error saving locally:', error);
      throw error; 
    }
  };

  // --- UPDATED LOGIC: Live Conversion applied here ---
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
    let conversionMessage = "";

    // 1. Perform Conversion
    if (contributeCurrency !== goalCurrency) {
      try {
        const conversionResult = await api.convertCurrency(amount, contributeCurrency, goalCurrency);
        
        if (conversionResult && conversionResult.rate) {
            amountInGoalCurrency = conversionResult.convertedAmount;
            currentExchangeRate = conversionResult.rate;
            
            // Create feedback message
            conversionMessage = `\n\nConverted: ${amount} ${contributeCurrency} → ${amountInGoalCurrency.toFixed(2)} ${goalCurrency}\n(Rate: ${currentExchangeRate.toFixed(4)})`;
            
            // Notify user
            Alert.alert("Currency Converted", `Using live rate: ${conversionMessage}`);
        }
      } catch (error) {
        console.warn("API conversion failed", error.message);
        Alert.alert("Offline Warning", "Could not get live rate. Saving as 1:1 for now.");
      }
    }

    const contribution = {
      id: Date.now() + Math.random(),
      userId: currentUser.id,
      userName: currentUser.name,
      amount: amount,
      amountInGoalCurrency: amountInGoalCurrency,
      currency: contributeCurrency,
      exchangeRate: currentExchangeRate,
      type: contributeType,
      date: new Date().toISOString(),
    };

    try {
      const storedGoals = await AsyncStorage.getItem(`personalGoals_${currentUser.id}`);
      const localGoals = storedGoals ? JSON.parse(storedGoals) : [];
      
      const goalIndex = localGoals.findIndex(g => g.id === selectedGoal.id);
      
      if (goalIndex !== -1) {
        if (!localGoals[goalIndex].contributions) {
            localGoals[goalIndex].contributions = [];
        }
        
        localGoals[goalIndex].contributions.push(contribution);
        
        if (contributeType === "add") {
          localGoals[goalIndex].currentAmount += amountInGoalCurrency;
        } else {
          localGoals[goalIndex].currentAmount = Math.max(0, localGoals[goalIndex].currentAmount - amountInGoalCurrency);
        }
        
        await AsyncStorage.setItem(`personalGoals_${currentUser.id}`, JSON.stringify(localGoals));
        
        Alert.alert(
          "Success", 
          `${contributeType === "add" ? "Added to" : "Deducted from"} goal successfully!${conversionMessage}`,
          [{ text: "OK" }]
        );
      } else {
        throw new Error('Goal not found locally.');
      }
    } catch (localError) {
      console.error('❌ Local contribution save failed:', localError);
      Alert.alert("Error", "Failed to save contribution. Please try again.");
    }

    await loadGoals(); 
    setShowContributeModal(false);
    setContributeAmount("");
    setContributeCurrency(currency);
    setShowContributeCurrencyDropdown(false);
    setSelectedGoal(null);
    setIsLoading(false);
  };

  const handleDeleteGoal = (goalId) => {
    Alert.alert(
      "Delete Goal",
      "Are you sure you want to delete this goal?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const storedGoals = await AsyncStorage.getItem(`personalGoals_${currentUser.id}`);
              const localGoals = storedGoals ? JSON.parse(storedGoals) : [];
              
              const filteredGoals = localGoals.filter(g => g.id !== goalId);
              await AsyncStorage.setItem(`personalGoals_${currentUser.id}`, JSON.stringify(filteredGoals));
              
              Alert.alert("Deleted", "Goal has been deleted successfully.");
            } catch (localError) {
              console.error('❌ Local deletion failed:', localError);
              Alert.alert("Error", "Failed to delete goal.");
              return;
            }
            
            await loadGoals(); 
          },
        },
      ]
    );
  };

  const getProgress = (current, target) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? "#fff" : "#111" }]}>
          Personal Goals
        </Text>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: isDark ? "#2563EB" : "#3B82F6" }]}
          onPress={() => {
            setTargetCurrency(currency);
            setShowCreateModal(true);
          }}
        >
          <Feather name="plus" color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
      >
        {personalGoals.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="target" size={64} color={isDark ? "#374151" : "#d1d5db"} />
            <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              No personal goals yet
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
              Create your first goal to start tracking your progress
            </Text>
          </View>
        ) : (
          personalGoals.map((goal) => {
            const progress = getProgress(goal.currentAmount, goal.targetAmount);
            const remaining = goal.targetAmount - goal.currentAmount;

            return (
              <View
                key={goal.id}
                style={[styles.goalCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}
              >
                <View style={styles.goalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalTitle, { color: isDark ? "#fff" : "#111" }]}>
                      {goal.title}
                    </Text>
                    <Text style={[styles.goalAmount, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                      {goal.currency || currency} {goal.currentAmount.toFixed(2)} / {goal.currency || currency} {goal.targetAmount.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteGoal(goal.id)}
                    style={styles.deleteButton}
                  >
                    <Feather name="trash-2" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBarBg, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: progress >= 100 ? "#10b981" : "#3B82F6",
                      },
                    ]}
                  />
                </View>

                <View style={styles.progressInfo}>
                  <Text style={[styles.progressText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                    {progress.toFixed(0)}% Complete
                  </Text>
                  {remaining > 0 && (
                    <Text style={[styles.remainingText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                      {goal.currency || currency} {remaining.toFixed(2)} remaining
                    </Text>
                  )}
                  {progress >= 100 && (
                    <Text style={[styles.completedText, { color: "#10b981" }]}>
                      ✓ Goal Achieved!
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDark ? "#065f46" : "#10b981" }]}
                    onPress={() => {
                      setSelectedGoal(goal);
                      setContributeType("add");
                      setContributeCurrency(goal.currency || currency);
                      setShowContributeModal(true);
                    }}
                  >
                    <Feather name="plus-circle" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Add Savings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: isDark ? "#991b1b" : "#ef4444" }]}
                    onPress={() => {
                      setSelectedGoal(goal);
                      setContributeType("expense");
                      setContributeCurrency(goal.currency || currency);
                      setShowContributeModal(true);
                    }}
                  >
                    <Feather name="minus-circle" size={16} color="#fff" />
                    <Text style={styles.actionButtonText}>Add Expense</Text>
                  </TouchableOpacity>
                </View>

                {/* Recent Contributions */}
                {goal.contributions && goal.contributions.length > 0 && (
                  <View style={styles.contributionsSection}>
                    <Text style={[styles.contributionsTitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                      Recent Activity
                    </Text>
                    {goal.contributions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3).map((contrib, idx) => (
                      <View key={idx} style={styles.contributionRow}>
                        <View style={styles.contributionInfo}>
                          <Feather 
                            name={contrib.type === "add" ? "arrow-up" : "arrow-down"} 
                            size={14} 
                            color={contrib.type === "add" ? "#10b981" : "#ef4444"} 
                          />
                          <View style={{ marginLeft: 8 }}>
                            <Text style={[styles.contributionText, { color: isDark ? "#fff" : "#111" }]}>
                              {contrib.type === "add" ? "Added" : "Spent"}
                            </Text>
                            {contrib.date && (
                              <Text style={[styles.contributionDate, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                                {new Date(contrib.date).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[styles.contributionAmount, { color: isDark ? "#fff" : "#111" }]}>
                            {contrib.type === "add" ? "+" : "-"}
                            {contrib.currency && contrib.currency !== (goal.currency || currency) && contrib.amountInGoalCurrency ? (
                              <>
                                <Text style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                                  {contrib.currency} {contrib.amount.toFixed(2)} ≈ 
                                </Text>
                                <Text style={{ fontWeight: "600" }}>
                                  {goal.currency || currency} {contrib.amountInGoalCurrency.toFixed(2)}
                                </Text>
                              </>
                            ) : (
                              `${goal.currency || currency} ${(contrib.amountInGoalCurrency || contrib.amount).toFixed(2)}`
                            )}
                          </Text>
                          {contrib.exchangeRate && contrib.exchangeRate !== 1 && (
                            <Text style={[styles.exchangeRateText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                              Rate: {contrib.exchangeRate.toFixed(4)}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                    {goal.contributions && goal.contributions.length > 3 && (
                      <TouchableOpacity 
                        style={styles.viewHistoryButton}
                        onPress={() => {
                          setHistoryGoal(goal);
                          setShowHistoryModal(true);
                        }}
                      >
                        <Text style={styles.viewHistoryText}>View All History</Text>
                        <Feather name="chevron-right" size={16} color="#6366f1" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create Goal Modal */}
      {showCreateModal && (
        <Modal
          title="Create Personal Goal"
          appContext={appContext}
          onClose={() => {
            setShowCreateModal(false);
            setGoalTitle("");
            setTargetAmount("");
          }}
        >
          <View>
            {/* Goal Title Section */}
            <View style={styles.goalTitleSection}>
              <Text style={[styles.sectionLabel, { color: isDark ? "#fff" : "#111" }]}>
                Goal Title
              </Text>
              <TextInput
                placeholder="e.g. Save for vacation, New laptop"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                value={goalTitle}
                onChangeText={setGoalTitle}
                style={[
                  styles.titleInput,
                  {
                    backgroundColor: isDark ? "#1f2937" : "#fff",
                    borderColor: isDark ? "#374151" : "#e2e8f0",
                    color: isDark ? "#fff" : "#111",
                  },
                ]}
              />
            </View>

            {/* Currency Selection Section */}
            <View style={styles.currencySection}>
              <Text style={[styles.sectionLabel, { color: isDark ? "#fff" : "#111" }]}>
                Currency
              </Text>
              <View style={styles.currencyContainer}>
                <TouchableOpacity
                  onPress={() => setShowTargetCurrencyDropdown(!showTargetCurrencyDropdown)}
                  style={[styles.currencySelector, { 
                    backgroundColor: isDark ? "#1f2937" : "#f8fafc", 
                    borderColor: isDark ? "#374151" : "#e2e8f0" 
                  }]}
                >
                  <View style={styles.currencyDisplay}>
                    <View style={[styles.currencyIconContainer, { backgroundColor: isDark ? "#374151" : "#e2e8f0" }]}>
                      <Text style={[styles.currencySymbolLarge, { color: isDark ? "#fff" : "#111" }]}>
                        {currencies.find(c => c.code === targetCurrency)?.symbol || "₱"}
                      </Text>
                    </View>
                    <View style={styles.currencyInfo}>
                      <Text style={[styles.currencyNameLarge, { color: isDark ? "#fff" : "#111" }]}>
                        {currencies.find(c => c.code === targetCurrency)?.name || "Philippine Peso"}
                      </Text>
                      <Text style={[styles.currencyCodeSmall, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                        {targetCurrency}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-down" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
                </TouchableOpacity>
                
                {showTargetCurrencyDropdown && (
                  <View style={[styles.currencyDropdown, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e2e8f0" }]}>
                    <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                      {currencies.map((curr) => (
                        <TouchableOpacity
                          key={curr.code}
                          onPress={() => {
                            setTargetCurrency(curr.code);
                            setShowTargetCurrencyDropdown(false);
                          }}
                          style={[styles.currencyDropdownItem, {
                            backgroundColor: targetCurrency === curr.code ? (isDark ? "#374151" : "#f1f5f9") : "transparent"
                          }]}
                        >
                          <View style={styles.currencyOption}>
                            <Text style={[styles.currencySymbol, { color: isDark ? "#fff" : "#111" }]}>{curr.symbol}</Text>
                            <View style={styles.currencyDetails}>
                              <Text style={[styles.currencyName, { color: isDark ? "#fff" : "#111" }]}>{curr.name}</Text>
                              <Text style={[styles.currencyCode, { color: isDark ? "#9ca3af" : "#6b7280" }]}>{curr.code}</Text>
                            </View>
                          </View>
                          {targetCurrency === curr.code && (
                            <Feather name="check" size={16} color="#3B82F6" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Target Amount Section */}
            <View style={styles.amountSection}>
              <Text style={[styles.sectionLabel, { color: isDark ? "#fff" : "#111" }]}>
                Target Amount
              </Text>
              <View style={styles.amountInputContainer}>
                <View style={[styles.amountInput, {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e2e8f0",
                }]}>
                  <Text style={[styles.currencyPrefixInInput, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                    {currencies.find(c => c.code === targetCurrency)?.symbol || "₱"}
                  </Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                    keyboardType="numeric"
                    value={targetAmount}
                    onChangeText={setTargetAmount}
                    style={[styles.amountTextInput, { color: isDark ? "#fff" : "#111" }]}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity style={[styles.modalButton, { marginTop: 8 }]} onPress={handleCreateGoal}>
              <Text style={styles.modalButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Contribute Modal */}
      {showContributeModal && selectedGoal && (
        <Modal
          title={contributeType === "add" ? "Add Savings" : "Add Expense"}
          appContext={appContext}
          onClose={() => {
            setShowContributeModal(false);
            setContributeAmount("");
            setSelectedGoal(null);
          }}
        >
          <View>
            <Text style={[styles.goalInfoText, { color: isDark ? "#3B82F6" : "#2563EB" }]}>
              Goal: {selectedGoal.title}
            </Text>

            {/* Currency Selection Section */}
            <View style={styles.currencySection}>
              <Text style={[styles.sectionLabel, { color: isDark ? "#fff" : "#111" }]}>
                Currency
              </Text>
              <View style={styles.currencyContainer}>
                <TouchableOpacity
                  onPress={() => setShowContributeCurrencyDropdown(!showContributeCurrencyDropdown)}
                  style={[styles.currencySelector, { 
                    backgroundColor: isDark ? "#1f2937" : "#f8fafc", 
                    borderColor: isDark ? "#374151" : "#e2e8f0" 
                  }]}
                >
                  <View style={styles.currencyDisplay}>
                    <View style={[styles.currencyIconContainer, { backgroundColor: isDark ? "#374151" : "#e2e8f0" }]}>
                      <Text style={[styles.currencySymbolLarge, { color: isDark ? "#fff" : "#111" }]}>
                        {currencies.find(c => c.code === contributeCurrency)?.symbol || "₱"}
                      </Text>
                    </View>
                    <View style={styles.currencyInfo}>
                      <Text style={[styles.currencyNameLarge, { color: isDark ? "#fff" : "#111" }]}>
                        {currencies.find(c => c.code === contributeCurrency)?.name || "Philippine Peso"}
                      </Text>
                      <Text style={[styles.currencyCodeSmall, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                        {contributeCurrency}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-down" size={20} color={isDark ? "#9ca3af" : "#6b7280"} />
                </TouchableOpacity>
                
                {showContributeCurrencyDropdown && (
                  <View style={[styles.currencyDropdown, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e2e8f0" }]}>
                    <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
                      {currencies.map((curr) => (
                        <TouchableOpacity
                          key={curr.code}
                          onPress={() => {
                            setContributeCurrency(curr.code);
                            setShowContributeCurrencyDropdown(false);
                          }}
                          style={[styles.currencyDropdownItem, {
                            backgroundColor: contributeCurrency === curr.code ? (isDark ? "#374151" : "#f1f5f9") : "transparent"
                          }]}
                        >
                          <View style={styles.currencyOption}>
                            <Text style={[styles.currencySymbol, { color: isDark ? "#fff" : "#111" }]}>{curr.symbol}</Text>
                            <View style={styles.currencyDetails}>
                              <Text style={[styles.currencyName, { color: isDark ? "#fff" : "#111" }]}>{curr.name}</Text>
                              <Text style={[styles.currencyCode, { color: isDark ? "#9ca3af" : "#6b7280" }]}>{curr.code}</Text>
                            </View>
                          </View>
                          {contributeCurrency === curr.code && (
                            <Feather name="check" size={16} color="#3B82F6" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Amount Input Section */}
            <View style={styles.amountSection}>
              <Text style={[styles.sectionLabel, { color: isDark ? "#fff" : "#111" }]}>
                Amount
              </Text>
              <View style={styles.amountInputContainer}>
                <View style={[styles.amountInput, {
                  backgroundColor: isDark ? "#1f2937" : "#fff",
                  borderColor: isDark ? "#374151" : "#e2e8f0",
                }]}>
                  <Text style={[styles.currencyPrefixInInput, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                    {currencies.find(c => c.code === contributeCurrency)?.symbol || "₱"}
                  </Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                    keyboardType="numeric"
                    value={contributeAmount}
                    onChangeText={setContributeAmount}
                    style={[styles.amountTextInput, { color: isDark ? "#fff" : "#111" }]}
                  />
                </View>
              </View>
            </View>

            {/* Conversion Preview */}
            {convertedAmount && contributeCurrency !== (selectedGoal?.currency || currency) && (
              <View style={[styles.conversionPreview, {
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.05)",
                borderColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)",
              }]}>
                <View style={styles.conversionHeader}>
                  <Feather name="refresh-cw" size={16} color="#3B82F6" />
                  <Text style={[styles.conversionLabel, { color: isDark ? "#60a5fa" : "#3B82F6" }]}>
                    Conversion Preview
                  </Text>
                </View>
                <Text style={[styles.conversionText, { color: isDark ? "#fff" : "#111" }]}>
                  {contributeAmount} {contributeCurrency} ≈ {convertedAmount} {selectedGoal?.currency || currency}
                </Text>
                <Text style={[styles.exchangeRateText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  Exchange Rate: {exchangeRate.toFixed(4)}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.modalButton, { opacity: isLoading ? 0.6 : 1 }]} 
              onPress={handleContribute} 
              disabled={isLoading}
            >
              <Text style={styles.modalButtonText}>
                {isLoading ? "Processing..." : (contributeType === "add" ? "Add to Goal" : "Deduct from Goal")}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Transaction History Modal */}
      {showHistoryModal && historyGoal && (
        <Modal
          title={`Transaction History - ${historyGoal.title}`}
          appContext={appContext}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryGoal(null);
          }}
        >
          <ScrollView style={styles.historyModalContent}>
            {historyGoal.contributions && historyGoal.contributions.length > 0 ? (
              historyGoal.contributions.slice().reverse().map((contrib, idx) => (
                <View key={idx} style={styles.historyItem}>
                  <View style={styles.historyItemHeader}>
                    <View style={styles.contributionInfo}>
                      <Feather 
                        name={contrib.type === "add" ? "arrow-up" : "arrow-down"} 
                        size={16} 
                        color={contrib.type === "add" ? "#10b981" : "#ef4444"} 
                      />
                      <Text style={[styles.historyItemType, { color: isDark ? "#fff" : "#111" }]}>
                        {contrib.type === "add" ? "Added" : "Spent"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.historyItemAmount, { 
                        color: contrib.type === "add" ? "#10b981" : "#ef4444" 
                      }]}>
                        {contrib.type === "add" ? "+" : "-"}
                        {contrib.currency && contrib.currency !== (historyGoal.currency || currency) && contrib.amountInGoalCurrency ? (
                          <>
                            <Text style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                              {contrib.currency} {contrib.amount.toFixed(2)} ≈ 
                            </Text>
                            <Text style={{ fontWeight: "600" }}>
                              {historyGoal.currency || currency} {contrib.amountInGoalCurrency.toFixed(2)}
                            </Text>
                          </>
                        ) : (
                          `${historyGoal.currency || currency} ${(contrib.amountInGoalCurrency || contrib.amount).toFixed(2)}`
                        )}
                      </Text>
                      {contrib.exchangeRate && contrib.exchangeRate !== 1 && (
                        <Text style={[styles.exchangeRateText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                          Rate: {contrib.exchangeRate.toFixed(4)}
                        </Text>
                      )}
                    </View>
                  </View>
                  {contrib.date && (
                    <Text style={[styles.historyItemDate, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                      {new Date(contrib.date).toLocaleDateString()} at {new Date(contrib.date).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={[styles.noHistoryText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                No transaction history available
              </Text>
            )}
          </ScrollView>
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
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: { 
    fontSize: 28, 
    fontWeight: "700",
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  goalCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  goalAmount: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  deleteButton: {
    padding: 4,
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    marginTop: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 5,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  progressText: {
    fontSize: 13,
    fontWeight: "600",
  },
  remainingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  completedText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  contributionsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(100, 100, 100, 0.1)",
  },
  contributionsTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  contributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  contributionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contributionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  contributionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  contributionAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  modalButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  goalInfoText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  currencyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 100,
    justifyContent: "space-between",
  },
  currencyButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: "500",
  },
  currencyOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  currencyName: {
    fontSize: 14,
    fontWeight: "500",
  },
  dropdown: {
    position: "absolute",
    top: 55,
    right: 0,
    left: 0,
    zIndex: 1000,
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 250,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  viewHistoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#6366f1",
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  viewHistoryText: {
    color: "#6366f1",
    fontSize: 14,
    fontWeight: "500",
    marginRight: 4,
  },
  historyModalContent: {
    maxHeight: 400,
  },
  historyItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyItemType: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  historyItemAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  historyItemDate: {
    fontSize: 12,
    marginLeft: 24,
  },
  noHistoryText: {
    textAlign: "center",
    fontSize: 14,
    fontStyle: "italic",
    padding: 20,
  },
  conversionPreview: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  conversionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  conversionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  conversionText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  exchangeRateText: {
    fontSize: 12,
    textAlign: "center",
  },
  goalTitleSection: {
    marginBottom: 20,
  },
  titleInput: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    fontSize: 16,
    fontWeight: "500",
  },
  currencySection: {
    marginTop: 24,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  currencyContainer: {
    position: "relative",
  },
  currencySelector: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currencyDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  currencyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  currencySymbolLarge: {
    fontSize: 18,
    fontWeight: "700",
  },
  currencyInfo: {
    flex: 1,
  },
  currencyNameLarge: {
    fontSize: 16,
    fontWeight: "600",
  },
  currencyCodeSmall: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  currencyDropdown: {
    position: "absolute",
    top: 75,
    left: 0,
    right: 0,
    zIndex: 1000,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  currencyDropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  currencyDetails: {
    flex: 1,
  },
  amountSection: {
    marginBottom: 24,
  },
  amountInputContainer: {
    position: "relative",
  },
  amountInput: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  currencyPrefixInInput: {
    fontSize: 18,
    fontWeight: "600",
  },
  amountTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    padding: 0,
  },
  historyModalContent: {
    maxHeight: 400,
  },
  historyItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  historyItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  historyItemType: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  historyItemAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  historyItemDate: {
    fontSize: 12,
    marginLeft: 24,
  },
});