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
  Image,
  KeyboardAvoidingView,
  Platform,
  Share 
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { mockBudgets } from "../utils/mockData"; 
import Modal from "../components/Modal";
import api from "../services/api";

// --- FIREBASE IMPORTS ---
import { db } from '../fintrack/firebase/firebase'; 
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  arrayUnion, 
  arrayRemove, 
  increment,
  getDoc, 
  writeBatch,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

// --- UTILITY: DETERMINISTIC COLOR GENERATOR ---
const getUserColor = (userId) => {
  if (!userId) return "#9ca3af"; 
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", "#06b6d4", "#3b82f6", "#6366F1", "#8b5cf6", "#d946ef", "#f43f5e"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function CategoryDetailScreen({ route, navigation, appContext }) {
  const { categoryName, categoryData, isSharedView } = route.params;
  const theme = appContext?.theme || "light";
  const currency = appContext?.currency || "PHP";
  const currentUser = appContext?.currentUser || null;
  const isDark = theme === "dark";

  const userId = currentUser?.uid || currentUser?.id;

  const isCategoryCreator = categoryData.originalOwner === userId || categoryData.origin !== "shared_invite";

  // --- SHARED DATA STATES ---
  const [liveBudgets, setLiveBudgets] = useState([]); 
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [userImages, setUserImages] = useState({}); 
  const [expandedBudgets, setExpandedBudgets] = useState({}); 

  // --- MODAL STATES ---
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  // --- EDIT BUDGET LIMIT STATES ---
  const [showEditBudgetModal, setShowEditBudgetModal] = useState(false);
  const [newBudgetLimit, setNewBudgetLimit] = useState("");
  
  // --- MEMBER DETAIL STATES ---
  const [currentMembers, setCurrentMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null); 

  // --- TRANSACTION STATES ---
  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeType, setContributeType] = useState("add");
  const [contributeCurrency, setContributeCurrency] = useState(currency);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false); 

  // --- PERSONAL BUDGET STATES (Legacy) ---
  const [categoryBudget, setCategoryBudget] = useState(categoryData?.budget || 0);
  const [categorySpent, setCategorySpent] = useState(categoryData?.spent || 0);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetAction, setBudgetAction] = useState("set");
  const [refreshing, setRefreshing] = useState(false);

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
    setContributeCurrency(currency);
  }, [currency]);

  // --- FIREBASE LISTENER ---
  useEffect(() => {
    if (!isSharedView || !userId) return;

    const q = query(
      collection(db, 'shared_budgets'),
      where("participants", "array-contains", userId),
      where("category", "==", categoryName)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLiveBudgets(fetched);
    }, (error) => console.error("Detail Sync Error:", error));

    return () => unsubscribe();
  }, [userId, categoryName, isSharedView]);

  // --- FETCH USER IMAGES ---
  useEffect(() => {
    const fetchImages = async () => {
        const uidsToFetch = new Set();
        liveBudgets.forEach(budget => {
            if (budget.participants) budget.participants.forEach(uid => uidsToFetch.add(uid));
            if (budget.ownerId) uidsToFetch.add(budget.ownerId);
        });
        const uniqueUids = Array.from(uidsToFetch).filter(uid => !userImages[uid]);
        if (uniqueUids.length === 0) return;
        const newImageMap = { ...userImages };
        await Promise.all(uniqueUids.map(async (uid) => {
            try {
                const snap = await getDoc(doc(db, "users", uid));
                if (snap.exists()) {
                    const data = snap.data();
                    newImageMap[uid] = data.profileImage || data.profilePicture || null;
                }
            } catch (e) { console.warn("Failed to fetch image", uid); }
        }));
        setUserImages(newImageMap);
    };
    if (liveBudgets.length > 0) fetchImages();
  }, [liveBudgets]);

  // --- LOCAL DATA RELOAD ---
  useEffect(() => {
    if (!isSharedView && currentUser) {
      if (mockBudgets[currentUser.id]?.categories?.[categoryName]) {
        const catData = mockBudgets[currentUser.id].categories[categoryName];
        setCategoryBudget(catData.budget || catData.total || 0);
        setCategorySpent(catData.spent || 0);
      }
    }
  }, [currentUser, categoryName, isSharedView]);

  // --- CURRENCY PREVIEW ---
  useEffect(() => {
    const calculateConversion = async () => {
      if (!selectedBudget || !contributeAmount || !contributeCurrency) return;
      const amount = parseFloat(contributeAmount);
      if (isNaN(amount) || amount <= 0) {
        setConvertedAmount("");
        setExchangeRate(1);
        return;
      }
      const budgetCurrency = selectedBudget.currency || currency;
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
  }, [contributeCurrency, contributeAmount, selectedBudget]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const toggleHistoryExpand = (budgetId) => {
      setExpandedBudgets(prev => ({
          ...prev,
          [budgetId]: !prev[budgetId]
      }));
  };

  // --- INVITE TO BUDGET ---
  const handleInviteToBudget = async (budget) => {
    if (!budget.id) return;
    try {
        const response = await api.createInvitation('budget', budget.id, 60 * 24 * 5); 
        Alert.alert(
            "Budget Invite Code", 
            `Share this code to invite users to "${budget.title}":\n\n${response.invitation.code}`,
            [{ text: "OK" }]
        );
    } catch (error) {
        Alert.alert("Error", "Failed to create invite code.");
    }
  };

  // --- DELETE BUDGET ---
  const handleDeleteBudget = async (budget) => {
      Alert.alert(
          "Delete Budget?",
          `Are you sure you want to delete "${budget.title}"?`,
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete", 
                  style: "destructive", 
                  onPress: async () => {
                      try {
                          await deleteDoc(doc(db, 'shared_budgets', budget.id));
                      } catch (error) {
                          Alert.alert("Error", "Failed to delete budget.");
                      }
                  }
              }
          ]
      );
  };

  // --- DELETE CATEGORY ---
  const handleDeleteCategory = async () => {
    if (!isCategoryCreator) {
        Alert.alert("Permission Denied", "Only the creator can delete this category.");
        return;
    }
    Alert.alert(
        "Delete Category?",
        "This will permanently delete this category and ALL shared budgets inside it.",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive",
                onPress: async () => {
                    setIsDeleting(true);
                    try {
                        const batch = writeBatch(db);
                        const budgetsQuery = query(
                            collection(db, "shared_budgets"),
                            where("ownerId", "==", userId),
                            where("category", "==", categoryName)
                        );
                        const budgetSnaps = await getDocs(budgetsQuery);
                        budgetSnaps.forEach((budgetDoc) => batch.delete(budgetDoc.ref));
                        if (categoryData.id) {
                            const categoryRef = doc(db, "users", userId, "categories", categoryData.id);
                            batch.delete(categoryRef);
                        }
                        await batch.commit();
                        Alert.alert("Deleted", "Category and budgets deleted.");
                        navigation.navigate('Dashboard'); 
                    } catch (error) {
                        Alert.alert("Error", "Could not delete category.");
                    } finally {
                        setIsDeleting(false);
                    }
                }
            }
        ]
    );
  };

  // --- UPDATE BUDGET LIMIT ---
  const handleUpdateBudgetLimit = async () => {
      if (!selectedBudget || !newBudgetLimit) return;
      const amount = parseFloat(newBudgetLimit);
      if (isNaN(amount) || amount <= 0) {
          Alert.alert("Invalid", "Please enter a valid amount.");
          return;
      }

      setIsLoading(true);
      try {
          const budgetRef = doc(db, 'shared_budgets', selectedBudget.id);
          await updateDoc(budgetRef, { targetAmount: amount });
          
          Alert.alert("Success", "Budget limit updated.");
          setShowEditBudgetModal(false);
          setNewBudgetLimit("");
          setSelectedBudget(null);
      } catch (error) {
          console.error(error);
          Alert.alert("Error", "Failed to update budget.");
      } finally {
          setIsLoading(false);
      }
  };

  // --- OPEN MEMBERS LIST ---
  const openMembersList = async (budget) => {
      setSelectedBudget(budget); 
      setShowMembersModal(true);
      setLoadingMembers(true); 
      setCurrentMembers([]); 
      const participantIds = budget.participants || [budget.ownerId]; 
      try {
          const userPromises = participantIds.map(uid => getDoc(doc(db, 'users', uid)));
          const userSnaps = await Promise.all(userPromises);
          const fetchedMembers = userSnaps.map(snap => {
              if (snap.exists()) {
                  const data = snap.data();
                  return {
                      uid: snap.id,
                      name: data.name || data.displayName || "User",
                      email: data.email,
                      photoURL: data.profileImage || null, 
                      role: snap.id === budget.ownerId ? 'Owner' : 'Member'
                  };
              }
              return null;
          }).filter(Boolean);
          fetchedMembers.sort((a, b) => a.role === 'Owner' ? -1 : 1);
          setCurrentMembers(fetchedMembers);
      } catch (error) {
          Alert.alert("Error", "Could not load member details.");
      } finally {
          setLoadingMembers(false);
      }
  };

  // --- REMOVE MEMBER ---
  const handleRemoveMember = async () => {
      if (!selectedMember || !selectedBudget) return;
      Alert.alert(
          "Remove Member",
          `Remove ${selectedMember.name} from this budget?`,
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Remove", 
                  style: "destructive",
                  onPress: async () => {
                      setIsRemovingMember(true);
                      try {
                          const budgetRef = doc(db, 'shared_budgets', selectedBudget.id);
                          await updateDoc(budgetRef, { participants: arrayRemove(selectedMember.uid) });
                          Alert.alert("Success", "Member removed.");
                          setSelectedMember(null); 
                          openMembersList(selectedBudget);
                      } catch (error) {
                          Alert.alert("Error", "Failed to remove member.");
                      } finally {
                          setIsRemovingMember(false);
                      }
                  }
              }
          ]
      );
  };

  // --- CONTRIBUTE ---
  const handleContribute = async () => {
    if (!contributeAmount.trim()) return;
    const amount = parseFloat(contributeAmount);
    if (isNaN(amount) || amount <= 0) return;
    setIsLoading(true);
    try {
        const budgetCurrency = selectedBudget.currency || currency;
        let amountInBudgetCurrency = amount;
        let currentExchangeRate = 1;
        if (contributeCurrency !== budgetCurrency) {
            const result = await api.convertCurrency(amount, contributeCurrency, budgetCurrency);
            if (result && result.convertedAmount) {
                amountInBudgetCurrency = result.convertedAmount;
                currentExchangeRate = result.rate;
            }
        }
        const contribution = {
          id: Date.now().toString(),
          userId: userId,
          userName: currentUser.name || "User",
          amount: amount,
          amountInBudgetCurrency: amountInBudgetCurrency,
          currency: contributeCurrency,
          exchangeRate: currentExchangeRate,
          type: contributeType,
          date: new Date().toISOString(),
        };
        const budgetRef = doc(db, 'shared_budgets', selectedBudget.id);
        
        const change = contributeType === "add" ? amountInBudgetCurrency : -amountInBudgetCurrency;
        
        await updateDoc(budgetRef, {
            currentAmount: increment(change),
            contributions: arrayUnion(contribution)
        });
        Alert.alert("Success", "Transaction synced!");
        setShowContributeModal(false);
        setContributeAmount("");
        setSelectedBudget(null);
    } catch (error) {
        Alert.alert("Error", "Failed to update budget.");
    } finally {
        setIsLoading(false);
    }
  };

  // --- PERSONAL BUDGET SET ---
  const handleSetBudget = () => {
    const amount = parseFloat(budgetAmount);
    if (!amount || amount <= 0) return;
    let newBudget = categoryBudget;
    if (budgetAction === "set") newBudget = amount;
    else if (budgetAction === "add") newBudget = categoryBudget + amount;
    else if (budgetAction === "subtract") newBudget = Math.max(0, categoryBudget - amount);
    if (mockBudgets[currentUser.id]?.categories) {
      mockBudgets[currentUser.id].categories[categoryName] = {
        ...mockBudgets[currentUser.id].categories[categoryName],
        budget: newBudget,
        total: newBudget,
      };
      setCategoryBudget(newBudget);
    }
    setShowBudgetModal(false);
    setBudgetAmount("");
    Alert.alert("Success", `Budget updated locally.`);
  };

  const remaining = categoryBudget - categorySpent;
  const percentSpent = categoryBudget > 0 ? (categorySpent / categoryBudget) * 100 : 0;

  return (
    <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        enabled
    >
        <View style={[styles.container, { backgroundColor: isDark ? "#111827" : "#f9fafb" }]}>
        {/* Header */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')}>
            <Ionicons name="arrow-back" color={isDark ? "#fff" : "#111"} size={24} />
            </TouchableOpacity>
            
            <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#111" }]}>{categoryName}</Text>
            
            {/* DELETE BUTTON - Only shows for creator */}
            {isCategoryCreator ? (
                <TouchableOpacity onPress={handleDeleteCategory} disabled={isDeleting}>
                    {isDeleting ? (
                        <ActivityIndicator color="#ef4444" size="small" />
                    ) : (
                        <Feather name="trash-2" size={24} color="#ef4444" />
                    )}
                </TouchableOpacity>
            ) : (
                <View style={{ width: 24 }} /> 
            )}
        </View>

        <ScrollView
            contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3B82F6"]} tintColor="#3B82F6" />}
            keyboardShouldPersistTaps="handled"
        >
            {isSharedView ? (
            <View style={styles.contentSection}>
                {liveBudgets.length > 0 ? (
                liveBudgets.map((budget) => {
                    const isOwner = budget.ownerId === userId;
                    
                    const totalAdded = budget.contributions?.filter(c => c.type === "add").reduce((sum, c) => sum + (c.amountInBudgetCurrency || c.amount), 0) || 0;
                    const totalSpent = budget.contributions?.filter(c => c.type === "expense").reduce((sum, c) => sum + (c.amountInBudgetCurrency || c.amount), 0) || 0;
                    const targetAmount = budget.targetAmount || 0;
                    const calculatedBalance = (targetAmount + totalAdded) - totalSpent;

                    const sortedTransactions = (budget.contributions || []).sort((a, b) => new Date(b.date) - new Date(a.date));
                    const isHistoryExpanded = expandedBudgets[budget.id] || false;
                    const visibleTransactions = isHistoryExpanded ? sortedTransactions : sortedTransactions.slice(0, 3);
                    const hasMoreHistory = sortedTransactions.length > 3;

                    return (
                    <View key={budget.id} style={[styles.budgetCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
                        
                        {/* HEADER with Edit/Delete/Invite */}
                        <View style={styles.budgetHeader}>
                            <View style={{ flex: 1 }}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                    <Text style={[styles.budgetTitle, { color: isDark ? "#fff" : "#111" }]}>{budget.title}</Text>
                                    
                                    {/* OWNER CONTROLS: Edit Limit & Delete Budget */}
                                    {isOwner && (
                                        <>
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    setSelectedBudget(budget);
                                                    setNewBudgetLimit(targetAmount.toString());
                                                    setShowEditBudgetModal(true);
                                                }}
                                                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                                            >
                                                <Feather name="edit-3" size={16} color={isDark ? "#9ca3af" : "#6b7280"} />
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                onPress={() => handleDeleteBudget(budget)}
                                                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                                            >
                                                <Feather name="trash-2" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                                <Text style={[styles.itemOwnerText, { color: isDark ? "#9ca3af" : "#6b7280", marginTop: 4 }]}>
                                Limit: {budget.currency || currency} {targetAmount.toFixed(2)}
                                </Text>
                            </View>

                            <View style={{flexDirection: 'row', gap: 8}}>
                                {/* INVITE TO BUDGET BUTTON (Owner Only) */}
                                {isOwner && (
                                    <TouchableOpacity 
                                        style={[styles.sharedBadge, { backgroundColor: isDark ? "#374151" : "#e0f2fe", paddingHorizontal: 8 }]}
                                        onPress={() => handleInviteToBudget(budget)}
                                    >
                                        <Feather name="user-plus" size={16} color={isDark ? "#60a5fa" : "#0284c7"} />
                                    </TouchableOpacity>
                                )}

                                {/* VIEW MEMBERS BUTTON */}
                                <TouchableOpacity 
                                    style={[styles.sharedBadge, { backgroundColor: isDark ? "#374151" : "#e0f2fe" }]}
                                    onPress={() => openMembersList(budget)}
                                >
                                    <Feather name="users" size={14} color={isDark ? "#60a5fa" : "#0284c7"} />
                                    <Text style={[styles.sharedBadgeText, { color: isDark ? "#60a5fa" : "#0284c7" }]}>
                                    {(budget.sharedWith?.length || 0) + 1}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* STATS */}
                        <View style={styles.statsContainer}>
                        <View style={[styles.statCard, { backgroundColor: isDark ? "#064e3b" : "#d1fae5" }]}>
                            <Text style={[styles.statLabel, { color: isDark ? "#6ee7b7" : "#065f46" }]}>Added</Text>
                            <Text style={[styles.statValue, { color: isDark ? "#10b981" : "#047857" }]}>{currency} {totalAdded.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: isDark ? "#7c2d12" : "#fed7aa" }]}>
                            <Text style={[styles.statLabel, { color: isDark ? "#fbbf24" : "#92400e" }]}>Spent</Text>
                            <Text style={[styles.statValue, { color: isDark ? "#f59e0b" : "#b45309" }]}>{currency} {totalSpent.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }]}>
                            <Text style={[styles.statLabel, { color: isDark ? "#93c5fd" : "#1e40af" }]}>Balance</Text>
                            <Text style={[styles.statValue, { color: isDark ? "#60a5fa" : "#2563eb" }]}>{currency} {calculatedBalance.toFixed(2)}</Text>
                        </View>
                        </View>

                        {/* ACTIONS */}
                        <View style={styles.actionButtonsRow}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#10b981" }]} onPress={() => { setSelectedBudget(budget); setContributeType("add"); setContributeCurrency(budget.currency || currency); setShowContributeModal(true); }}>
                            <Feather name="plus" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>Add Funds</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#f59e0b" }]} onPress={() => { setSelectedBudget(budget); setContributeType("expense"); setContributeCurrency(budget.currency || currency); setShowContributeModal(true); }}>
                            <Feather name="minus" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>Record Spend</Text>
                        </TouchableOpacity>
                        </View>

                        {/* HISTORY */}
                        <View style={styles.historySection}>
                        <Text style={[styles.historyTitle, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Recent Activity</Text>
                        {visibleTransactions.length > 0 ? (
                            <>
                                {visibleTransactions.map((tx, index) => {
                                    const userColor = getUserColor(tx.userId);
                                    const isForeignTransaction = tx.currency && tx.currency !== (budget.currency || currency);
                                    const userProfilePic = userImages[tx.userId]; 
                                    return (
                                        <TouchableOpacity 
                                            key={index} 
                                            style={[styles.transactionRow, { borderBottomColor: isDark ? "#374151" : "#f3f4f6" }]}
                                            onPress={() => setSelectedTransaction(tx)}
                                        >
                                        <View style={{ position: 'relative' }}>
                                            {userProfilePic ? (
                                                <Image source={{ uri: userProfilePic }} style={{width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: userColor}} />
                                            ) : (
                                                <View style={[styles.txIcon, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff', borderWidth: 1.5, borderColor: userColor, width: 36, height: 36, borderRadius: 18 }]}>
                                                    <Feather name={tx.type === 'add' ? "arrow-up-right" : "shopping-cart"} size={16} color={tx.type === 'add' ? "#10b981" : "#f59e0b"} />
                                                </View>
                                            )}
                                            {userProfilePic && (
                                                <View style={{position: 'absolute', bottom: -2, right: -2, backgroundColor: tx.type === 'add' ? "#10b981" : "#f59e0b", borderRadius: 8, width: 14, height: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: isDark ? '#1f2937' : '#fff'}}>
                                                    <Feather name={tx.type === 'add' ? "plus" : "minus"} size={8} color="#fff" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.txUser, { color: isDark ? "#fff" : "#111" }]}>{tx.userName} {tx.userId === userId ? "(You)" : ""}</Text>
                                            <Text style={[styles.txDate, { color: isDark ? "#9ca3af" : "#6b7280" }]}>{new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                            {isForeignTransaction && (
                                                <Text style={{ fontSize: 11, color: isDark ? '#9ca3af' : '#666', marginTop: 2, fontStyle: 'italic' }}>Pd: {tx.currency} {tx.amount?.toFixed(2)}</Text>
                                            )}
                                        </View>
                                        <View style={{alignItems: 'flex-end'}}>
                                            <Text style={[styles.txAmount, { color: tx.type === 'add' ? "#10b981" : "#f59e0b" }]}>
                                                {tx.type === 'add' ? '+' : '-'}{budget.currency || currency} {tx.amountInBudgetCurrency?.toFixed(2) || tx.amount}
                                            </Text>
                                        </View>
                                        </TouchableOpacity>
                                    );
                                })}
                                {hasMoreHistory && (
                                    <TouchableOpacity style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }} onPress={() => toggleHistoryExpand(budget.id)}>
                                        <Text style={{ color: '#3B82F6', fontWeight: '600', fontSize: 14 }}>{isHistoryExpanded ? "Show Less" : `View All Activities (${sortedTransactions.length})`}</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <Text style={{ color: isDark ? "#6b7280" : "#9ca3af", fontSize: 13, fontStyle: 'italic', marginTop: 5 }}>No transactions yet.</Text>
                        )}
                        </View>
                    </View>
                    );
                })
                ) : (
                <View style={[styles.card, { backgroundColor: isDark ? "#1f2937" : "#fff", padding: 20 }]}>
                    <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280", textAlign: 'center' }]}>No shared budgets in this category yet.</Text>
                </View>
                )}
            </View>
            ) : (
            // Personal Budget View
            <View style={styles.contentSection}>
                <View style={[styles.card, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
                <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#111" }]}>Budget Overview</Text>
                <View style={styles.budgetRow}>
                    <Text style={[styles.label, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Total Budget</Text>
                    <Text style={[styles.amount, { color: isDark ? "#fff" : "#111" }]}>{currency} {categoryBudget.toFixed(2)}</Text>
                </View>
                <View style={styles.budgetRow}>
                    <Text style={[styles.label, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Spent</Text>
                    <Text style={[styles.amount, { color: "#ef4444" }]}>-{currency} {categorySpent.toFixed(2)}</Text>
                </View>
                <View style={styles.budgetRow}>
                    <Text style={[styles.label, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Remaining</Text>
                    <Text style={[styles.amount, { color: remaining >= 0 ? "#10b981" : "#ef4444" }]}>{currency} {remaining.toFixed(2)}</Text>
                </View>
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
                    <View style={[styles.progressFill, { width: `${Math.min(percentSpent, 100)}%`, backgroundColor: percentSpent > 100 ? "#ef4444" : "#3B82F6" }]} />
                    </View>
                    <Text style={[styles.progressText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>{percentSpent.toFixed(0)}% used</Text>
                </View>
                <TouchableOpacity onPress={() => { setBudgetAmount(categoryBudget > 0 ? categoryBudget.toString() : ""); setShowBudgetModal(true); }} style={styles.primaryButton}>
                    <Feather name="edit-2" color="#fff" size={18} />
                    <Text style={styles.primaryButtonText}>Set Budget</Text>
                </TouchableOpacity>
                </View>
            </View>
            )}
        </ScrollView>

        {/* --- CONTRIBUTE MODAL --- */}
        {showContributeModal && selectedBudget && (
            <Modal title={contributeType === "add" ? "Add to Budget" : "Record Expense"} appContext={appContext} onClose={() => { setShowContributeModal(false); setSelectedBudget(null); setContributeAmount(""); }}>
                <View>
                    <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16, marginBottom: 10, fontWeight: '600' }}>{selectedBudget.title}</Text>
                    <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                        <View style={{flex: 1}}>
                            <Text style={{color: isDark ? "#fff" : "#000", marginBottom: 5, fontWeight: '600'}}>Currency</Text>
                            <TouchableOpacity onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)} style={[styles.input, {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb"}]}>
                                <Text style={{color: isDark ? "#fff" : "#000"}}>{contributeCurrency}</Text>
                                <Feather name="chevron-down" size={20} color={isDark ? "#fff" : "#000"} />
                            </TouchableOpacity>
                        </View>
                        <View style={{flex: 2}}>
                            <Text style={{color: isDark ? "#fff" : "#000", marginBottom: 5, fontWeight: '600'}}>Amount</Text>
                            <TextInput placeholder="0.00" placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"} keyboardType="numeric" value={contributeAmount} onChangeText={setContributeAmount} style={[styles.input, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]} />
                        </View>
                    </View>
                    {showCurrencyDropdown && (
                        <View style={{maxHeight: 150, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: isDark ? '#222' : '#fff'}}>
                            <ScrollView nestedScrollEnabled>
                                {currencies.map(curr => (
                                    <TouchableOpacity key={curr.code} style={{padding: 12, borderBottomWidth: 1, borderColor: '#eee'}} onPress={() => { setContributeCurrency(curr.code); setShowCurrencyDropdown(false); }}>
                                        <Text style={{color: isDark ? '#fff' : '#000'}}>{curr.code} - {curr.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                    {convertedAmount && contributeCurrency !== (selectedBudget?.currency || currency) && (
                        <View style={{backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', padding: 10, borderRadius: 8, marginBottom: 20}}>
                            <Text style={{color: '#3B82F6', fontSize: 13}}>≈ {selectedBudget?.currency || currency} {convertedAmount} <Text style={{fontSize: 11, color: '#888'}}> (Rate: {exchangeRate.toFixed(4)})</Text></Text>
                        </View>
                    )}
                    <TouchableOpacity style={[styles.modalButton, { backgroundColor: contributeType === 'add' ? "#10b981" : "#ef4444", opacity: isLoading ? 0.6 : 1 }]} onPress={handleContribute} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>{contributeType === 'add' ? "Add Amount" : "Confirm Expense"}</Text>}
                    </TouchableOpacity>
                </View>
            </Modal>
        )}

        {/* --- EDIT BUDGET LIMIT MODAL (NEW) --- */}
        {showEditBudgetModal && selectedBudget && (
            <Modal title="Edit Budget Limit" appContext={appContext} onClose={() => setShowEditBudgetModal(false)}>
                <View>
                    <Text style={{color: isDark ? "#fff" : "#111", marginBottom: 10}}>Current Limit: {selectedBudget.currency || currency} {selectedBudget.targetAmount}</Text>
                    <TextInput 
                        placeholder="New Limit Amount" 
                        value={newBudgetLimit} 
                        onChangeText={setNewBudgetLimit} 
                        keyboardType="numeric" 
                        style={[styles.input, {color: isDark ? "#fff" : "#111", borderColor: isDark ? "#374151" : "#e5e7eb", backgroundColor: isDark ? '#1f2937' : '#fff', marginBottom: 15}]} 
                    />
                    <TouchableOpacity style={[styles.modalButton, { opacity: isLoading ? 0.6 : 1 }]} onPress={handleUpdateBudgetLimit} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Update Limit</Text>}
                    </TouchableOpacity>
                </View>
            </Modal>
        )}

        {/* --- MEMBERS MODAL --- */}
        {showMembersModal && (
            <Modal title="Budget Members" appContext={appContext} onClose={() => setShowMembersModal(false)}>
            <ScrollView style={{maxHeight: 300}}>
                {loadingMembers ? <ActivityIndicator size="large" color="#3B82F6" style={{padding: 20}} /> : currentMembers.map((member, index) => {
                    const memberColor = getUserColor(member.uid);
                    return (
                        <TouchableOpacity key={index} style={{flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: isDark ? '#374151' : '#f3f4f6'}} onPress={() => setSelectedMember(member)}>
                            {member.photoURL ? <Image source={{ uri: member.photoURL }} style={{width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 2, borderColor: isDark ? '#1f2937' : '#fff'}} /> : <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: memberColor, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 2, borderColor: isDark ? '#1f2937' : '#fff', elevation: 2}}><Text style={{color: '#fff', fontWeight: '700', fontSize: 16}}>{member.name ? member.name.charAt(0).toUpperCase() : "?"}</Text></View>}
                            <View style={{flex: 1}}>
                                <Text style={{color: isDark ? '#fff' : '#111', fontWeight: '600', fontSize: 15}}>{member.name || "Unknown"} {member.uid === userId && "(You)"}</Text>
                                <Text style={{color: isDark ? '#9ca3af' : '#6b7280', fontSize: 12}}>{member.email}</Text>
                            </View>
                            {member.role === 'Owner' && <View style={{backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6}}><Text style={{color: isDark ? '#93c5fd' : '#2563eb', fontSize: 10, fontWeight: '700'}}>OWNER</Text></View>}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            </Modal>
        )}

        {/* --- MEMBER DETAIL MODAL --- */}
        {selectedMember && (
            <Modal title="Member Details" appContext={appContext} onClose={() => setSelectedMember(null)}>
                <View style={{alignItems: 'center', paddingVertical: 20}}>
                    {selectedMember.photoURL ? <Image source={{ uri: selectedMember.photoURL }} style={{width: 100, height: 100, borderRadius: 50, marginBottom: 15, borderWidth: 4, borderColor: isDark ? '#374151' : '#fff'}} /> : <View style={{width: 100, height: 100, borderRadius: 50, backgroundColor: getUserColor(selectedMember.uid), justifyContent: 'center', alignItems: 'center', marginBottom: 15}}><Text style={{color: '#fff', fontSize: 40, fontWeight: 'bold'}}>{selectedMember.name.charAt(0).toUpperCase()}</Text></View>}
                    <Text style={{color: isDark ? '#fff' : '#111', fontSize: 20, fontWeight: 'bold', marginBottom: 5}}>{selectedMember.name}</Text>
                    <Text style={{color: isDark ? '#9ca3af' : '#6b7280', fontSize: 14, marginBottom: 20}}>{selectedMember.email}</Text>
                    <View style={{backgroundColor: selectedMember.role === 'Owner' ? '#dbeafe' : '#f3f4f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 30}}>
                        <Text style={{color: selectedMember.role === 'Owner' ? '#2563eb' : '#4b5563', fontWeight: '600'}}>{selectedMember.role.toUpperCase()}</Text>
                    </View>
                    {selectedBudget && selectedBudget.ownerId === userId && selectedMember.uid !== userId && selectedMember.role !== 'Owner' && (
                        <TouchableOpacity style={{backgroundColor: '#fee2e2', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center'}} onPress={handleRemoveMember} disabled={isRemovingMember}>
                            {isRemovingMember ? <ActivityIndicator color="#ef4444" /> : <><Feather name="user-x" size={20} color="#ef4444" /><Text style={{color: '#ef4444', fontWeight: '700'}}>Remove from Budget</Text></>}
                        </TouchableOpacity>
                    )}
                </View>
            </Modal>
        )}

        {/* --- TRANSACTION DETAIL MODAL --- */}
        {selectedTransaction && (
            <Modal title="Transaction Details" appContext={appContext} onClose={() => setSelectedTransaction(null)}>
                <View style={{padding: 10}}>
                    <View style={{alignItems: 'center', marginBottom: 20}}>
                        <View style={{width: 60, height: 60, borderRadius: 30, backgroundColor: selectedTransaction.type === 'add' ? '#d1fae5' : '#fed7aa', justifyContent: 'center', alignItems: 'center', marginBottom: 10}}>
                            <Feather name={selectedTransaction.type === 'add' ? "arrow-up-right" : "shopping-cart"} size={30} color={selectedTransaction.type === 'add' ? "#10b981" : "#f59e0b"} />
                        </View>
                        <Text style={{fontSize: 24, fontWeight: 'bold', color: selectedTransaction.type === 'add' ? "#10b981" : "#f59e0b"}}>
                            {selectedTransaction.type === 'add' ? "+" : "-"}{currency} {selectedTransaction.amountInBudgetCurrency?.toFixed(2)}
                        </Text>
                        <Text style={{color: isDark ? '#9ca3af' : '#6b7280'}}>{new Date(selectedTransaction.date).toLocaleString()}</Text>
                    </View>
                    <View style={{backgroundColor: isDark ? '#1f2937' : '#f9fafb', padding: 15, borderRadius: 12}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                            <Text style={{color: isDark ? '#9ca3af' : '#6b7280'}}>User</Text>
                            <Text style={{color: isDark ? '#fff' : '#111', fontWeight: '600'}}>{selectedTransaction.userName}</Text>
                        </View>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                            <Text style={{color: isDark ? '#9ca3af' : '#6b7280'}}>Type</Text>
                            <Text style={{color: isDark ? '#fff' : '#111', fontWeight: '600'}}>{selectedTransaction.type === 'add' ? 'Deposit' : 'Expense'}</Text>
                        </View>
                        {selectedTransaction.currency && selectedTransaction.currency !== currency && (
                            <>
                                <View style={{height: 1, backgroundColor: isDark ? '#374151' : '#e5e7eb', marginVertical: 10}} />
                                <Text style={{color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 8, fontSize: 12, fontWeight: '700', textTransform: 'uppercase'}}>Conversion Info</Text>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                                    <Text style={{color: isDark ? '#9ca3af' : '#6b7280'}}>Original Amount</Text>
                                    <Text style={{color: isDark ? '#fff' : '#111'}}>{selectedTransaction.currency} {selectedTransaction.amount?.toFixed(2)}</Text>
                                </View>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                    <Text style={{color: isDark ? '#9ca3af' : '#6b7280'}}>Exchange Rate</Text>
                                    <Text style={{color: isDark ? '#fff' : '#111'}}>1 {selectedTransaction.currency} = {selectedTransaction.exchangeRate?.toFixed(4)} {currency}</Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        )}

        {/* --- SET BUDGET MODAL (Legacy) --- */}
        {showBudgetModal && (
            <Modal title="Manage Category Budget" appContext={appContext} onClose={() => { setShowBudgetModal(false); setBudgetAction("set"); }}>
                <View>
                    <Text style={{color: isDark ? "#fff" : "#111", fontSize: 16, marginBottom: 12}}>Current Budget: {currency} {categoryBudget.toFixed(2)}</Text>
                    <View style={styles.actionSelector}>
                        <TouchableOpacity onPress={() => setBudgetAction('set')} style={[styles.actionButton, budgetAction === 'set' && styles.actionButtonActive, {backgroundColor: budgetAction === 'set' ? '#3B82F6' : 'transparent'}]}><Text style={{color: budgetAction === 'set' ? '#fff' : (isDark ? '#ccc' : '#555')}}>Set</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setBudgetAction('add')} style={[styles.actionButton, budgetAction === 'add' && styles.actionButtonActive, {backgroundColor: budgetAction === 'add' ? '#10b981' : 'transparent'}]}><Text style={{color: budgetAction === 'add' ? '#fff' : (isDark ? '#ccc' : '#555')}}>Add</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setBudgetAction('subtract')} style={[styles.actionButton, budgetAction === 'subtract' && styles.actionButtonActive, {backgroundColor: budgetAction === 'subtract' ? '#ef4444' : 'transparent'}]}><Text style={{color: budgetAction === 'subtract' ? '#fff' : (isDark ? '#ccc' : '#555')}}>Sub</Text></TouchableOpacity>
                    </View>
                    <TextInput placeholder="Enter amount" keyboardType="numeric" value={budgetAmount} onChangeText={setBudgetAmount} style={[styles.input, {color: isDark ? "#fff" : "#111", borderColor: isDark ? "#374151" : "#e5e7eb", backgroundColor: isDark ? '#1f2937' : '#fff'}]} />
                    <TouchableOpacity style={styles.modalButton} onPress={handleSetBudget}><Text style={styles.modalButtonText}>Save</Text></TouchableOpacity>
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
  headerTitle: { fontSize: 20, fontWeight: "700" },
  contentSection: { paddingHorizontal: 20, marginTop: 20 },
  budgetCard: { borderRadius: 16, padding: 20, marginBottom: 20, elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  budgetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  budgetTitle: { fontSize: 20, fontWeight: "700", letterSpacing: 0.3 },
  itemOwnerText: { fontSize: 12, fontWeight: "500" },
  sharedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  sharedBadgeText: { fontSize: 13, fontWeight: "600" },
  statsContainer: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center", gap: 4 },
  statLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  actionButtonsRow: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, gap: 8, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  historySection: { marginTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 16 },
  historyTitle: { fontSize: 13, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  transactionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 12 },
  txIcon: { justifyContent: "center", alignItems: "center" },
  txUser: { fontSize: 14, fontWeight: "600" },
  txDate: { fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: "700" },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  label: { fontSize: 14, fontWeight: "500" },
  amount: { fontSize: 18, fontWeight: "700" },
  progressContainer: { marginTop: 16 },
  progressBar: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  progressText: { fontSize: 12, marginTop: 4, textAlign: "right" },
  primaryButton: { backgroundColor: "#3B82F6", flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 14, borderRadius: 10, marginTop: 16, gap: 8 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 20 },
  modalButton: { backgroundColor: "#3B82F6", paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  modalButtonText: { color: "#fff", fontSize: 16, textAlign: "center", fontWeight: "600" },
  actionSelector: { flexDirection: "row", gap: 8, marginBottom: 16 },
  actionButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: "center" },
  actionButtonActive: { elevation: 2 },
  emptyText: { fontSize: 14, fontStyle: "italic" }
});