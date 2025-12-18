// screens/CategoryGoalsScreen.js
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
import { Feather, MaterialIcons, Ionicons } from "@expo/vector-icons";
import { mockBudgets, mockGoals, invitationCodes, mockUsers, mockGoalCategories, mockSharedGoals } from "../utils/mockData";
import { generateInviteCode } from "../utils/helpers";
import Modal from "../components/Modal";
import api from "../services/api";

export default function CategoryGoalsScreen({ route, navigation, appContext }) {
  const { categoryName, categoryData, isSharedView } = route.params;
  const theme = appContext?.theme || "light";
  const currency = appContext?.currency || "PHP";
  const currentUser = appContext?.currentUser || null;
  const isDark = theme === "dark";

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goals, setGoals] = useState([]);
  const [sharedGoals, setSharedGoals] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeType, setContributeType] = useState("add");
  const [contributeCurrency, setContributeCurrency] = useState(currency);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedGoalHistory, setSelectedGoalHistory] = useState(null);

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
  }, [currentUser, categoryName]);

  const loadData = () => {
    if (!currentUser) return;

    // Load shared goals if in shared view
    if (isSharedView) {
      const allSharedGoals = Object.values(mockSharedGoals).filter(
        goal => goal.category === categoryName && 
               (goal.ownerId === currentUser.id || (goal.sharedWith && goal.sharedWith.includes(currentUser.id)))
      );
      setSharedGoals(allSharedGoals);
    } else {
      // Load personal goals for this category
      if (mockGoals[currentUser.id]) {
        const categoryGoals = mockGoals[currentUser.id].filter(
          (g) => g.category === categoryName
        );
        setGoals(categoryGoals);
      }
    }

    // Load collaborators
    const collabs = [];
    Object.entries(invitationCodes).forEach(([code, data]) => {
      if (data.category === categoryName && data.ownerId === currentUser.id) {
        collabs.push(...(data.sharedWith || []));
      }
    });
    setCollaborators([...new Set(collabs)]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Generate consistent color for each user
  const getUserColor = (userId) => {
    const colors = [
      "#3B82F6", // blue
      "#10B981", // green
      "#F59E0B", // amber
      "#EF4444", // red
      "#8B5CF6", // purple
      "#EC4899", // pink
      "#06B6D4", // cyan
      "#F97316", // orange
      "#14B8A6", // teal
      "#A855F7", // violet
    ];
    // Use userId to consistently pick a color
    const hash = userId.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleCreateGoal = () => {
    if (!goalTitle.trim() || !goalAmount.trim()) {
      Alert.alert("Invalid", "Please enter goal title and amount");
      return;
    }

    const amount = parseFloat(goalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    const newGoal = {
      id: Date.now(),
      category: categoryName,
      title: goalTitle.trim(),
      targetAmount: amount,
      currentAmount: 0,
      createdAt: new Date().toISOString(),
      contributions: [],
    };

    if (!mockGoals[currentUser.id]) {
      mockGoals[currentUser.id] = [];
    }
    mockGoals[currentUser.id].push(newGoal);
    setGoals([...mockGoals[currentUser.id].filter((g) => g.category === categoryName)]);

    setShowGoalModal(false);
    setGoalTitle("");
    setGoalAmount("");
    Alert.alert("Goal Created", `${goalTitle} goal created successfully!`);
  };

  const handleContributeToGoal = async () => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid", "Please enter a valid amount");
      return;
    }

    if (!selectedGoal) {
      return;
    }

    setIsLoading(true);

    // Get the goal's currency
    const goalCurrency = selectedGoal.currency || currency;
    let amountInGoalCurrency = amount;
    let exchangeRate = 1;

    // Convert to goal's currency if different
    if (contributeCurrency !== goalCurrency) {
      try {
        const conversionResult = await api.convertCurrency(amount, contributeCurrency, goalCurrency);
        amountInGoalCurrency = conversionResult.convertedAmount;
        exchangeRate = conversionResult.rate;
      } catch (error) {
        setIsLoading(false);
        Alert.alert("Error", "Failed to convert currency. Please try again.");
        return;
      }
    }

    const contribution = {
      userId: currentUser.id,
      userName: currentUser.name,
      amount: amount,
      amountInGoalCurrency: amountInGoalCurrency,
      currency: contributeCurrency,
      exchangeRate: exchangeRate,
      type: contributeType,
      date: new Date().toISOString(),
    };

    // Handle shared goals
    if (isSharedView && mockSharedGoals[selectedGoal.id]) {
      if (!mockSharedGoals[selectedGoal.id].contributions) {
        mockSharedGoals[selectedGoal.id].contributions = [];
      }
      mockSharedGoals[selectedGoal.id].contributions.push(contribution);

      // For goals: add increases currentAmount (savings), expense/withdraw decreases it (use goal currency amount)
      if (contributeType === "add") {
        mockSharedGoals[selectedGoal.id].currentAmount += amountInGoalCurrency;
      } else {
        mockSharedGoals[selectedGoal.id].currentAmount = Math.max(0, mockSharedGoals[selectedGoal.id].currentAmount - amountInGoalCurrency);
      }

      setIsLoading(false);
      setShowContributeModal(false);
      setSelectedGoal(null);
      setContributeAmount("");
      setContributeType("add");
      setContributeCurrency(currency);
      setShowCurrencyDropdown(false);
      
      const actionText = contributeType === "add" ? "saved to" : "withdrawn from";
      Alert.alert("Success", `${goalCurrency} ${amountInGoalCurrency.toFixed(2)} ${actionText} goal!`);
      
      // Use navigation.replace() to refresh the screen
      navigation.replace("CategoryGoals", {
        categoryName,
        categoryData,
        isSharedView,
      });
      return;
    }

    // Handle personal goals
    if (!mockGoals[currentUser.id]) {
      return;
    }

    const goalIndex = mockGoals[currentUser.id].findIndex(g => g.id === selectedGoal.id);
    if (goalIndex === -1) return;

    if (!mockGoals[currentUser.id][goalIndex].contributions) {
      mockGoals[currentUser.id][goalIndex].contributions = [];
    }
    mockGoals[currentUser.id][goalIndex].contributions.push(contribution);

    if (contributeType === "add") {
      mockGoals[currentUser.id][goalIndex].currentAmount += amountInGoalCurrency;
    } else {
      mockGoals[currentUser.id][goalIndex].currentAmount = Math.max(0, mockGoals[currentUser.id][goalIndex].currentAmount - amountInGoalCurrency);
    }

    setGoals([...mockGoals[currentUser.id].filter((g) => g.category === categoryName)]);
    setIsLoading(false);
    setShowContributeModal(false);
    setSelectedGoal(null);
    setContributeAmount("");
    setContributeType("add");
    setContributeCurrency(currency);
    setShowCurrencyDropdown(false);
    
    const actionText = contributeType === "add" ? "added to" : "spent from";
    Alert.alert("Success", `${goalCurrency} ${amountInGoalCurrency.toFixed(2)} ${actionText} goal!`);
  };

  const handleInvite = () => {
    if (!currentUser) {
      Alert.alert("Error", "Please sign in to create invites.");
      return;
    }

    const code = generateInviteCode();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    invitationCodes[code] = {
      ownerId: currentUser.id,
      category: categoryName,
      expiresAt,
      sharedWith: [],
    };

    Alert.alert(
      "Invite Created",
      `Share this code to collaborate on ${categoryName}:\n\n${code}\n\nExpires in 5 minutes`,
      [
        {
          text: "Copy",
          onPress: () => {
            Alert.alert("Code", code);
          },
        },
        { text: "OK" },
      ]
    );
  };

  const handleDeleteGoal = (goalId) => {
    Alert.alert("Confirm", "Delete this goal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (mockGoals[currentUser.id]) {
            mockGoals[currentUser.id] = mockGoals[currentUser.id].filter(
              (g) => g.id !== goalId
            );
            setGoals([...mockGoals[currentUser.id].filter((g) => g.category === categoryName)]);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Dashboard');
          }
        }}>
          <Ionicons name="arrow-back" color={isDark ? "#fff" : "#111"} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#111" }]}>
          {categoryName}
        </Text>
        {!isSharedView ? (
          <TouchableOpacity onPress={() => setShowGoalModal(true)}>
            <Feather name="plus" color={isDark ? "#fff" : "#111"} size={24} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
      >
        {isSharedView ? (
          // Shared Goals View
          <View style={styles.contentSection}>
            {sharedGoals.length > 0 ? (
              sharedGoals.map((goal) => {
                const isOwner = goal.ownerId === currentUser.id;

                // For goals: track savings added and withdrawn (use goal currency amounts)
                const totalSaved = goal.contributions?.filter(c => c.type === "add").reduce((sum, c) => sum + (c.amountInGoalCurrency || c.amountPHP || c.amount), 0) || 0;
                const totalWithdrawn = goal.contributions?.filter(c => c.type === "expense").reduce((sum, c) => sum + (c.amountInGoalCurrency || c.amountPHP || c.amount), 0) || 0;
                const netSavings = totalSaved - totalWithdrawn; // Current amount saved toward goal
                const remainingToGoal = Math.max(0, goal.targetAmount - netSavings); // How much more needed
                const progressPercent = goal.targetAmount > 0 ? (netSavings / goal.targetAmount) * 100 : 0;

                return (
                  <View
                    key={goal.id}
                    style={[
                      styles.budgetCard,
                      {
                        backgroundColor: isDark ? "#1f2937" : "#fff",
                      },
                    ]}
                  >
                    {/* Header Section */}
                    <View style={styles.budgetHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.budgetTitle, { color: isDark ? "#fff" : "#111" }]}>
                          {goal.title}
                        </Text>
                        <Text style={[styles.itemOwnerText, { color: isDark ? "#9ca3af" : "#6b7280", marginTop: 4 }]}>
                          Owner: {goal.ownerName} {isOwner && "(You)"}
                        </Text>
                      </View>
                      {goal.sharedWith && goal.sharedWith.length > 0 && (
                        <View style={[styles.sharedBadge, { backgroundColor: isDark ? "#374151" : "#e0f2fe" }]}>
                          <Feather name="users" size={14} color={isDark ? "#60a5fa" : "#0284c7"} />
                          <Text style={[styles.sharedBadgeText, { color: isDark ? "#60a5fa" : "#0284c7" }]}>
                            {goal.sharedWith.length + 1}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Goal Stats Cards */}
                    <View style={styles.statsContainer}>
                      <View style={[styles.statCard, { backgroundColor: isDark ? "#064e3b" : "#d1fae5" }]}>
                        <Feather name="trending-up" size={18} color="#10b981" />
                        <Text style={[styles.statLabel, { color: isDark ? "#6ee7b7" : "#065f46" }]}>Saved</Text>
                        <Text style={[styles.statValue, { color: isDark ? "#10b981" : "#047857" }]}>
                          {goal.currency || "PHP"} {totalSaved.toFixed(2)}
                        </Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: isDark ? "#7c2d12" : "#fed7aa" }]}>
                        <Feather name="trending-down" size={18} color="#f59e0b" />
                        <Text style={[styles.statLabel, { color: isDark ? "#fbbf24" : "#92400e" }]}>Withdrawn</Text>
                        <Text style={[styles.statValue, { color: isDark ? "#f59e0b" : "#b45309" }]}>
                          {goal.currency || "PHP"} {totalWithdrawn.toFixed(2)}
                        </Text>
                      </View>

                      <View style={[styles.statCard, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }]}>
                        <Feather name="target" size={18} color="#3B82F6" />
                        <Text style={[styles.statLabel, { color: isDark ? "#93c5fd" : "#1e40af" }]}>To Goal</Text>
                        <Text style={[styles.statValue, { color: isDark ? "#60a5fa" : "#2563eb" }]}>
                          {goal.currency || "PHP"} {remainingToGoal.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Progress Section */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressHeader}>
                        <Text style={[styles.progressLabel, { color: isDark ? "#d1d5db" : "#374151" }]}>
                          Goal Progress
                        </Text>
                        <Text style={[styles.progressPercentage, { color: isDark ? "#fff" : "#111" }]}>
                          {progressPercent.toFixed(1)}%
                        </Text>
                      </View>
                      
                      <View style={[styles.progressBarContainer, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
                        {/* Savings shown with user-colored segments */}
                        {goal.contributions && goal.contributions.length > 0 && (
                          <View style={styles.progressBarSegmented}>
                            {(() => {
                              const savedContribs = goal.contributions.filter(c => c.type === "add");
                              let accumulatedWidth = 0;
                              
                              return savedContribs.map((contrib, idx) => {
                                const getUserColor = (userId) => {
                                  const colors = ["#3B82F6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
                                  const userIdStr = String(userId);
                                  const hash = userIdStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                  return colors[hash % colors.length];
                                };

                                const contribPercentage = goal.targetAmount > 0 ? ((contrib.amountInGoalCurrency || contrib.amountPHP || contrib.amount) / goal.targetAmount) * 100 : 0;
                                const segment = (
                                  <View
                                    key={idx}
                                    style={[
                                      styles.progressSegment,
                                      {
                                        width: `${contribPercentage}%`,
                                        backgroundColor: getUserColor(contrib.userId),
                                        left: `${accumulatedWidth}%`,
                                      },
                                    ]}
                                  />
                                );
                                accumulatedWidth += contribPercentage;
                                return segment;
                              });
                            })()}
                          </View>
                        )}
                      </View>

                      <View style={styles.amountDisplay}>
                        <Text style={[styles.currentAmount, { color: isDark ? "#fff" : "#111" }]}>
                          {goal.currency || "PHP"} {netSavings.toFixed(2)}
                        </Text>
                        <Text style={[styles.targetAmount, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
                          / {goal.currency || "PHP"} {goal.targetAmount?.toFixed(2) || "0.00"}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
                        onPress={() => {
                          setSelectedGoal(goal);
                          setContributeType("add");
                          setShowContributeModal(true);
                        }}
                      >
                        <Feather name="plus" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Add Savings</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                        onPress={() => {
                          setSelectedGoal(goal);
                          setContributeType("expense");
                          setShowContributeModal(true);
                        }}
                      >
                        <Feather name="minus" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Withdraw</Text>
                      </TouchableOpacity>
                    </View>

                    {goal.contributions && goal.contributions.length > 0 && (
                      <View style={[styles.contributionsList, { borderTopColor: isDark ? "#374151" : "#e5e7eb" }]}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <Text style={[styles.contributionsTitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                            Recent Activity
                          </Text>
                          {goal.contributions.length > 3 && (
                            <TouchableOpacity
                              onPress={() => {
                                setSelectedGoalHistory(goal);
                                setShowHistoryModal(true);
                              }}
                            >
                              <Text style={{ color: "#3B82F6", fontSize: 14, fontWeight: "600" }}>
                                View All ({goal.contributions.length})
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {goal.contributions.slice(-3).reverse().map((contrib, idx) => {
                          const getUserColor = (userId) => {
                            const colors = ["#3B82F6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
                            const userIdStr = String(userId);
                            const hash = userIdStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            return colors[hash % colors.length];
                          };

                          return (
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
                                    {new Date(contrib.date).toLocaleDateString()} at {new Date(contrib.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>
                              </View>
                              <View style={{ alignItems: "flex-end" }}>
                                <Text
                                  style={[
                                    styles.contributionAmount,
                                    {
                                      color: contrib.type === "add" ? "#10b981" : "#ef4444",
                                    },
                                  ]}
                                >
                                  {contrib.type === "add" ? "+" : "-"}
                                  {contrib.currency && contrib.currency !== (goal.currency || "PHP")
                                    ? `${contrib.currency} ${contrib.amount.toFixed(2)}`
                                    : `${goal.currency || "PHP"} ${(contrib.amountInGoalCurrency || contrib.amountPHP || contrib.amount).toFixed(2)}`
                                  }
                                </Text>
                                {contrib.currency && contrib.currency !== (goal.currency || "PHP") && contrib.exchangeRate !== 1 && (
                                  <Text
                                    style={[
                                      styles.contributionAmountPHP,
                                      {
                                        color: isDark ? "#9ca3af" : "#6b7280",
                                        fontSize: 12,
                                        marginTop: 2,
                                      },
                                    ]}
                                  >
                                    ≈ {goal.currency || "PHP"} {(contrib.amountInGoalCurrency || contrib.amountPHP || contrib.amount).toFixed(2)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                        {goal.contributions.length > 3 && (
                          <TouchableOpacity
                            style={{
                              paddingVertical: 12,
                              alignItems: "center",
                              borderTopWidth: 1,
                              borderTopColor: isDark ? "#374151" : "#e5e7eb",
                              marginTop: 8,
                            }}
                            onPress={() => {
                              setSelectedGoalHistory(goal);
                              setShowHistoryModal(true);
                            }}
                          >
                            <Text style={{ color: "#3B82F6", fontSize: 14, fontWeight: "600" }}>
                              View All History
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={[styles.card, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
                <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  No shared goals in this category yet. Create one from the Shared Goals screen!
                </Text>
              </View>
            )}
          </View>
        ) : (
          // Personal Goals View
          <>
            {/* Collaboration Section */}
            <View style={styles.contentSection}>
              <View style={[styles.card, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
                <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#111" }]}>
                  Collaboration
                </Text>
                <Text style={[styles.cardSubtitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  Invite others to collaborate on this category
                </Text>

                {collaborators.length > 0 && (
                  <View style={styles.collaboratorsList}>
                    <Text style={[styles.label, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                      Active Collaborators: {collaborators.length}
                    </Text>
                  </View>
                )}

                <TouchableOpacity onPress={handleInvite} style={styles.inviteButton}>
                  <Feather name="user-plus" color="#fff" size={18} />
                  <Text style={styles.inviteButtonText}>Create Invite Code</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Goals Section */}
            <View style={styles.contentSection}>
              <Text style={[styles.sectionTitle, { color: isDark ? "#fff" : "#111" }]}>
                Goals
              </Text>

              {goals.length === 0 ? (
                <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  No goals yet. Tap the + button above to create one!
                </Text>
              ) : (
              goals.map((goal) => {
                const goalProgress = goal.targetAmount > 0
                  ? (goal.currentAmount / goal.targetAmount) * 100
                  : 0;
                const contributions = goal.contributions || [];
                return (
                  <View
                    key={goal.id}
                    style={[styles.goalCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}
                  >
                    <View style={styles.goalHeader}>
                      <Text style={[styles.goalTitle, { color: isDark ? "#fff" : "#111" }]}>
                        {goal.title}
                      </Text>
                      <TouchableOpacity onPress={() => handleDeleteGoal(goal.id)}>
                        <Feather name="trash-2" color="#ef4444" size={18} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.goalAmount, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                      ₱{goal.currentAmount.toFixed(2)} / ₱{goal.targetAmount.toFixed(2)}
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: isDark ? "#374151" : "#e5e7eb", marginTop: 8 }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(goalProgress, 100)}%`,
                            backgroundColor: goalProgress >= 100 ? "#10b981" : categoryData?.color || "#3B82F6",
                          },
                        ]}
                      />
                    </View>

                    {/* Contribution Buttons */}
                    <View style={styles.contributionButtons}>
                      <TouchableOpacity
                        style={[styles.contributeBtn, { backgroundColor: "#10b981" }]}
                        onPress={() => {
                          setSelectedGoal(goal);
                          setContributeType("add");
                          setShowContributeModal(true);
                        }}
                      >
                        <Feather name="plus" color="#fff" size={16} />
                        <Text style={styles.contributeBtnText}>Add Savings</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.contributeBtn, { backgroundColor: "#ef4444" }]}
                        onPress={() => {
                          setSelectedGoal(goal);
                          setContributeType("expense");
                          setShowContributeModal(true);
                        }}
                      >
                        <Feather name="minus" color="#fff" size={16} />
                        <Text style={styles.contributeBtnText}>Add Expense</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Contributions List */}
                    {contributions.length > 0 && (
                      <View style={styles.contributionsList}>
                        <Text style={[styles.contributionsTitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                          Recent Contributions:
                        </Text>
                        {contributions.slice(-5).reverse().map((contrib, index) => {
                          const userColor = getUserColor(contrib.userId);
                          return (
                            <View key={index} style={styles.contributionItem}>
                              <View style={styles.contributionLeft}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                  <View 
                                    style={[
                                      styles.userColorIndicator, 
                                      { backgroundColor: userColor }
                                    ]} 
                                  />
                                <Text style={[styles.contributorName, { color: isDark ? "#fff" : "#111" }]}>
                                  {contrib.userName}
                                </Text>
                              </View>
                              <Text style={[styles.contributionDate, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
                                {new Date(contrib.date).toLocaleDateString()}
                              </Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                              <Text
                                style={[
                                  styles.contributionAmount,
                                  { color: contrib.type === "add" ? "#10b981" : "#ef4444" }
                                ]}
                              >
                                {contrib.type === "add" ? "+" : "-"}
                                {contrib.currency && contrib.currency !== 'PHP' 
                                  ? `${contrib.currency === 'USD' ? '$' : contrib.currency === 'EUR' ? '€' : contrib.currency === 'GBP' ? '£' : contrib.currency === 'JPY' ? '¥' : contrib.currency} ${contrib.amount.toFixed(2)}`
                                  : `₱${contrib.amount.toFixed(2)}`
                                }
                              </Text>
                              {contrib.currency && contrib.currency !== 'PHP' && contrib.amountPHP && (
                                <Text
                                  style={[
                                    styles.contributionAmountPHP,
                                    {
                                      color: isDark ? "#9ca3af" : "#6b7280",
                                      fontSize: 12,
                                      marginTop: 2,
                                    },
                                  ]}
                                >
                                  ≈ ₱{contrib.amountPHP.toFixed(2)}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Create Goal Modal */}
      {showGoalModal && (
        <Modal
          title="Create Budget Goal"
          appContext={appContext}
          onClose={() => setShowGoalModal(false)}
        >
          <View>
            <Text
              style={{
                color: isDark ? "#3B82F6" : "#2563EB",
                fontSize: 14,
                marginBottom: 12,
                fontWeight: "600",
              }}
            >
              Category: {categoryName}
            </Text>
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

            <TouchableOpacity style={styles.modalButton} onPress={handleCreateGoal}>
              <Text style={styles.modalButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Contribute to Goal Modal */}
      {showContributeModal && selectedGoal && (
        <Modal
          title={isSharedView ? (contributeType === "add" ? "Add Savings to Goal" : "Withdraw from Goal") : (contributeType === "add" ? "Add Savings" : "Add Expense")}
          appContext={appContext}
          onClose={() => {
            setShowContributeModal(false);
            setSelectedGoal(null);
            setContributeAmount("");
            setContributeType("add");
            setContributeCurrency(currency);
            setShowCurrencyDropdown(false);
          }}
        >
          <View>
            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 16,
                marginBottom: 8,
                fontWeight: "500",
              }}
            >
              Goal: {selectedGoal.title}
            </Text>
            <Text
              style={{
                color: isDark ? "#9ca3af" : "#6b7280",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {isSharedView ? "Progress" : "Current"}: {selectedGoal.currency || currency} {selectedGoal.currentAmount?.toFixed(2) || "0.00"} / {selectedGoal.currency || currency} {selectedGoal.targetAmount?.toFixed(2) || "0.00"}
            </Text>

            <Text
              style={{
                color: isDark ? "#fff" : "#111",
                fontSize: 14,
                marginBottom: 8,
                marginTop: 16,
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
                  {
                    position: "absolute",
                    top: 140,
                    left: 0,
                    right: 0,
                    backgroundColor: isDark ? "#1f2937" : "#fff",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isDark ? "#374151" : "#e5e7eb",
                    zIndex: 1000,
                    maxHeight: 200,
                  },
                ]}
              >
                <ScrollView>
                  {currencies.map((curr) => (
                    <TouchableOpacity
                      key={curr.code}
                      style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? "#374151" : "#e5e7eb",
                        backgroundColor: contributeCurrency === curr.code ? (isDark ? "#374151" : "#e5e7eb") : "transparent",
                      }}
                      onPress={() => {
                        setContributeCurrency(curr.code);
                        setShowCurrencyDropdown(false);
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View>
                          <Text
                            style={{
                              color: isDark ? "#fff" : "#111",
                              fontSize: 16,
                              fontWeight: "600",
                            }}
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
                fontSize: 14,
                marginBottom: 8,
                fontWeight: "600",
              }}
            >
              {isSharedView ? (contributeType === "add" ? "Amount to Save" : "Amount to Withdraw") : (contributeType === "add" ? "Amount to Add" : "Expense Amount")}
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
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: contributeType === "add" ? "#10b981" : "#ef4444", opacity: isLoading ? 0.6 : 1 }]}
              onPress={handleContributeToGoal}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>
                  {isSharedView ? (contributeType === "add" ? "Save" : "Withdraw") : (contributeType === "add" ? "Add Savings" : "Record Expense")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Full History Modal */}
      {showHistoryModal && selectedGoalHistory && (
        <Modal
          visible={showHistoryModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setShowHistoryModal(false);
            setSelectedGoalHistory(null);
          }}
          presentationStyle="fullScreen"
          statusBarTranslucent={false}
        >
          <View style={{ flex: 1, backgroundColor: isDark ? "#111827" : "#f3f4f6" }}>
            {/* Header */}
            <View style={{ 
              backgroundColor: isDark ? "#1f2937" : "#fff",
              paddingTop: 16,
              paddingBottom: 12,
              paddingHorizontal: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 3,
              elevation: 3
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <TouchableOpacity 
                  onPress={() => {
                    setShowHistoryModal(false);
                    setSelectedGoalHistory(null);
                  }}
                  style={{ 
                    position: "absolute",
                    left: 0,
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: isDark ? "#374151" : "#f3f4f6"
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color={isDark ? "#fff" : "#111"} />
                </TouchableOpacity>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 2 }}>
                    Goal
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: isDark ? "#fff" : "#111" }}>
                    {selectedGoalHistory.title}
                  </Text>
                </View>
              </View>
            </View>

            {/* Goal Stats */}
            <View style={{ backgroundColor: isDark ? "#1f2937" : "#fff", paddingVertical: 16, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 4, fontWeight: "500" }}>
                    Activity
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: isDark ? "#fff" : "#111" }}>
                    {selectedGoalHistory.contributions.length}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 4, fontWeight: "500" }}>
                    Current
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: "#10b981" }}>
                    ₱{(selectedGoalHistory.currentAmount || 0).toFixed(0)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 4, fontWeight: "500" }}>
                    Target
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: "700", color: isDark ? "#fff" : "#111" }}>
                    ₱{(selectedGoalHistory.targetAmount || 0).toFixed(0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* History List */}
            <ScrollView 
              style={{ flex: 1, backgroundColor: isDark ? "#111827" : "#f3f4f6" }} 
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedGoalHistory.contributions.slice().reverse().map((contrib, idx) => {
                const getUserColor = (userId) => {
                  const colors = ["#3B82F6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
                  const userIdStr = String(userId);
                  const hash = userIdStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  return colors[hash % colors.length];
                };

                return (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: isDark ? "#1f2937" : "#fff",
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      marginBottom: 8,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 2,
                      elevation: 1
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      {/* Left - Avatar and Name */}
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <View
                          style={{ 
                            backgroundColor: getUserColor(contrib.userId),
                            width: 24,
                            height: 24,
                            borderRadius: 12
                          }}
                        />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? "#fff" : "#111", marginBottom: 2 }}>
                            {contrib.userName}
                          </Text>
                          <Text style={{ fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>
                            {new Date(contrib.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric'
                            })} • {new Date(contrib.date).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </Text>
                        </View>
                      </View>

                      {/* Right - Amount */}
                      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                        <Text
                          style={{
                            color: contrib.type === "add" ? "#10b981" : "#ef4444",
                            fontSize: 15,
                            fontWeight: "700"
                          }}
                        >
                          {contrib.type === "add" ? "+" : "-"}
                          {contrib.currency && contrib.currency !== 'PHP' 
                            ? `${contrib.currency === 'USD' ? '$' : contrib.currency === 'EUR' ? '€' : contrib.currency === 'GBP' ? '£' : contrib.currency === 'JPY' ? '¥' : contrib.currency}${contrib.amount.toFixed(2)}`
                            : `₱${contrib.amount.toFixed(2)}`
                          }
                        </Text>
                        {contrib.currency && contrib.currency !== 'PHP' && contrib.amountPHP && (
                          <Text
                            style={{
                              color: isDark ? "#9ca3af" : "#6b7280",
                              fontSize: 10,
                              marginTop: 2
                            }}
                          >
                            ≈ ₱{contrib.amountPHP.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
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
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  contentSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
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
  inviteButton: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  inviteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  collaboratorsList: {
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
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
  contributionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  contributeBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  contributeBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  contributionsList: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#374151",
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
    marginLeft: 0,
  },
  contributorName: {
    fontSize: 14,
    fontWeight: "500",
  },
  contributionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  contributionAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  userColorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  // Shared Goals View Styles
  budgetCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  budgetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  itemOwnerText: {
    fontSize: 13,
  },
  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  sharedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: "700",
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    marginBottom: 8,
  },
  progressBarSegmented: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  progressSegment: {
    position: "absolute",
    top: 0,
    bottom: 0,
    height: "100%",
  },
  amountDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  currentAmount: {
    fontSize: 20,
    fontWeight: "700",
  },
  targetAmount: {
    fontSize: 14,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  contributorName: {
    fontSize: 14,
    fontWeight: "500",
  },
  contributionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  currencyPicker: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  currencyOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
});
