// screens/ExpensesScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  SectionList,
  Alert,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
// appContext comes from App.js via props
import { mockBudgets } from "../utils/mockData";
import Modal from "../components/Modal";
import { Feather } from "@expo/vector-icons";
import api from "../services/api"; 

export default function ExpensesScreen({ appContext, navigation }) {
  const theme = appContext?.theme || "light";
  const currentUser = appContext?.currentUser || null;
  const currency = appContext?.currency || "PHP";
  const isDark = theme === "dark";

  const currencyOptions = ["PHP", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CNY"];

  const [expenses, setExpenses] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "", amount: "", period: "today", description: "", currency: currency });
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("today"); 

  // Load user's expenses and categories
  const loadData = async () => {
    if (!currentUser) {
      setExpenses([]);
      return;
    }

    // 1. Load Total Budgets from AsyncStorage for persistence
    try {
        const storedLimits = await AsyncStorage.getItem(`userBudgetLimits_${currentUser.id}`);
        if (storedLimits) {
            const limits = JSON.parse(storedLimits);
            if (!mockBudgets[currentUser.id]) {
                 mockBudgets[currentUser.id] = { today: {}, week: {}, month: {} };
            }
            mockBudgets[currentUser.id].today.total = limits.today || 0;
            mockBudgets[currentUser.id].week.total = limits.week || 0;
            mockBudgets[currentUser.id].month.total = limits.month || 0;
        }
    } catch (e) {
        console.error("Failed to load budget limits in ExpensesScreen:", e);
    }

    try {
      const storedExpenses = await AsyncStorage.getItem(`expenses_${currentUser.id}`);
      if (storedExpenses) {
        const localExpenses = JSON.parse(storedExpenses);
        setExpenses(localExpenses);
        
        const uniqueCategories = [...new Set(localExpenses.map(exp => exp.category).filter(Boolean))];
        setAvailableCategories(uniqueCategories);
      } else {
        setExpenses([]);
        setAvailableCategories([]);
      }
    } catch (localError) {
      console.error('❌ Local backup load failed:', localError);
      setExpenses([]);
      setAvailableCategories([]);
    }
    
    if (mockBudgets[currentUser.id]?.categories) {
      const budgetCats = Object.keys(mockBudgets[currentUser.id].categories);
      setAvailableCategories(prev => [...new Set([...prev, ...budgetCats])]);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
        loadData();
    });
    loadData();
    return unsubscribe;
  }, [currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 500);
  };

  const getExpensesByPeriod = (period) => {
    if (!expenses || !Array.isArray(expenses)) return []; 
    return expenses.filter(exp => exp.period === period);
  };

  const getTotalSpentForPeriod = (period) => {
    // Calculates total spent using the CONVERTED PHP amount if available
    // This ensures the budget math is always accurate in the base currency
    return expenses
      .filter(exp => exp.period === period && !exp.archived)
      .reduce((sum, exp) => sum + (exp.amountPHP || exp.amount), 0);
  };

  const getBudgetForPeriod = (period) => {
    return mockBudgets[currentUser?.id]?.[period]?.total || 0;
  };

  const getPeriodLabel = (period) => {
    switch(period) {
      case 'today': return "Today's Budget";
      case 'week': return "This Week's Budget";
      case 'month': return "This Month's Budget";
      default: return period;
    }
  };

  const formatDateHeader = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown Date';
    }
  };

  const getDateKey = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error getting date key:', error);
      return new Date().toISOString().split('T')[0];
    }
  };

  const groupExpensesByDate = (expensesList) => {
    if (!expensesList || !Array.isArray(expensesList)) return [];
    const grouped = {};
    expensesList.forEach(expense => {
      let dateToUse;
      if (expense.archived && expense.archiveDate) {
        dateToUse = expense.archiveDate;
      } else if (expense.date) {
        const parsedDate = new Date(expense.date);
        dateToUse = isNaN(parsedDate.getTime()) ? new Date(expense.id || Date.now()).toISOString() : parsedDate.toISOString();
      } else {
        dateToUse = new Date(expense.id || Date.now()).toISOString();
      }
      
      const dateKey = getDateKey(dateToUse);
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          dateKey,
          dateHeader: formatDateHeader(dateToUse),
          data: [],
          archived: expense.archived || false
        };
      }
      grouped[dateKey].data.push(expense);
    });
    
    return Object.values(grouped).sort((a, b) => {
      return new Date(b.dateKey) - new Date(a.dateKey);
    });
  };

  // --- UPDATED LOGIC TO HANDLE CURRENCY CONVERSION ---
  const handleAddExpense = async () => {
    const { category, amount } = newExpense;
    const parsedAmount = parseFloat(amount);
    const expenseCurrency = newExpense.currency || currency;

    if (!category || !amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid", "Please enter valid category and amount.");
      return;
    }

    let amountInPHP = parsedAmount;
    let exchangeRate = 1;
    let conversionMessage = "";

    // Perform Live Conversion if not PHP
    if (expenseCurrency !== 'PHP') {
      try {
        // Calls the updated free API logic
        const conversionResult = await api.convertCurrency(parsedAmount, expenseCurrency, 'PHP');
        
        // The new API returns objects with rate/convertedAmount (no success flag needed)
        if (conversionResult && conversionResult.rate) {
          amountInPHP = conversionResult.convertedAmount;
          exchangeRate = conversionResult.rate;
          
          // Notify user of the exact conversion used
          conversionMessage = `${expenseCurrency} ${parsedAmount.toFixed(2)} ≈ ₱${amountInPHP.toFixed(2)}\n(Rate: ${exchangeRate.toFixed(4)})`;
          Alert.alert("Currency Converted", conversionMessage);
        } else {
          Alert.alert("Warning", "Could not fetch live rate. Recorded as PHP 1:1 for now.");
        }
      } catch (error) {
        console.error("Currency conversion error:", error);
        Alert.alert("Offline Mode", "Could not convert currency. Saved using 1:1 rate.");
      }
    }

    const expense = {
      id: Date.now(),
      userId: currentUser.id,
      category,
      amount: parsedAmount,
      amountPHP: amountInPHP, // Stores the standardized amount for budget math
      period: newExpense.period || "today",
      description: newExpense.description || "",
      currency: expenseCurrency, // Stores original currency for display
      exchangeRate,
      date: new Date().toISOString(),
      isPersonal: true,
    };

    // Save expense to local storage
    try {
      const storedExpenses = await AsyncStorage.getItem(`expenses_${currentUser.id}`);
      const localExpenses = storedExpenses ? JSON.parse(storedExpenses) : [];
      
      if (isEditing && editingId) {
        const updated = localExpenses.map((e) =>
          e.id === editingId ? { ...e, category, amount: parsedAmount, amountPHP: amountInPHP, currency: expenseCurrency, exchangeRate, date: new Date().toISOString() } : e
        );
        await AsyncStorage.setItem(`expenses_${currentUser.id}`, JSON.stringify(updated));
        Alert.alert("Success", "Expense updated!");
        setIsEditing(false);
        setEditingId(null);
      } else {
        const updatedExpenses = [expense, ...localExpenses];
        await AsyncStorage.setItem(`expenses_${currentUser.id}`, JSON.stringify(updatedExpenses));
        // No alert needed here if we showed the conversion alert, 
        // but good to confirm save if no conversion happened.
        if (expenseCurrency === 'PHP') {
            Alert.alert("Success", "Expense added!");
        }
      }
    } catch (localError) {
      console.error('❌ Local save failed:', localError);
      Alert.alert("Error", `Failed to ${isEditing ? 'update' : 'add'} expense.`);
      return;
    }

    // Update categories for dropdown
    if (category && !availableCategories.includes(category)) {
      setAvailableCategories(prev => [...prev, category]);
      if (mockBudgets[currentUser.id]) {
        if (!mockBudgets[currentUser.id].categories) {
          mockBudgets[currentUser.id].categories = {};
        }
        mockBudgets[currentUser.id].categories[category] = { budget: 0, spent: 0, color: "#60A5FA" };
      }
    }

    await loadData(); 
    setShowAddModal(false);
    setNewExpense({ category: "", amount: "", period: "today", description: "", currency: currency });
    setShowCategoryDropdown(false);
    setShowNewCategoryInput(false);
    setShowCurrencyDropdown(false);
  };

  const handleDelete = (id) => {
    Alert.alert("Confirm", "Delete this expense?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const storedExpenses = await AsyncStorage.getItem(`expenses_${currentUser.id}`);
            const localExpenses = storedExpenses ? JSON.parse(storedExpenses) : [];
            
            const filteredExpenses = localExpenses.filter(exp => exp.id !== id);
            await AsyncStorage.setItem(`expenses_${currentUser.id}`, JSON.stringify(filteredExpenses));
            
            Alert.alert("Deleted", "Expense deleted successfully.");
          } catch (localError) {
            console.error('❌ Local deletion failed:', localError);
            Alert.alert("Error", "Failed to delete expense.");
            return;
          }
          
          await loadData();
        },
      },
    ]);
  };

  const renderExpense = ({ item }) => {
    const isArchived = item.archived;
    
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (isArchived) {
            Alert.alert("Archived Expense", "This expense is from a previous budget period and cannot be edited.", [{ text: "OK" }]);
            return;
          }
          setIsEditing(true);
          setEditingId(item.id);
          setNewExpense({ 
            category: item.category, 
            amount: String(item.amount),
            period: item.period || 'today',
            description: item.description || '',
            currency: item.currency || currency
          });
          setShowAddModal(true);
        }}
        style={[
          styles.expenseCard,
          { 
            backgroundColor: isDark ? "#1f2937" : "#fff",
            opacity: isArchived ? 0.7 : 1,
          },
        ]}
        accessible
        accessibilityLabel={`Expense ${item.category} ${currency} ${item.amount}`}
      >
        <View style={styles.expenseLeft}>
          <View style={[
            styles.avatarPlaceholder, 
            { backgroundColor: isArchived ? (isDark ? "#374151" : "#9ca3af") : (isDark ? "#2563EB" : "#3B82F6") }
          ]}>
            <Feather name="shopping-bag" size={20} color="#fff" />
          </View>
          <View style={styles.expenseInfo}>
            <View style={styles.expenseMainRow}>
              <Text style={[styles.expenseCategory, { color: isDark ? "#fff" : "#111" }]} numberOfLines={1}>{item.category}</Text>
              {isArchived && (
                <View style={[styles.archivedBadge, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
                  <Text style={[styles.archivedBadgeText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                    Saved
                  </Text>
                </View>
              )}
            </View>
            {item.description ? (
              <Text 
                style={[styles.expenseDescription, { color: isDark ? "#9ca3af" : "#6b7280" }]}
                numberOfLines={1}
              >
                {item.description}
              </Text>
            ) : null}
            <Text style={[styles.expenseDate, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
              {item.date ? new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time N/A'}
            </Text>
          </View>
        </View>
        <View style={styles.expenseRight}>
          <View style={styles.amountContainer}>
            <Text style={[styles.expenseAmount, { color: isArchived ? (isDark ? "#9ca3af" : "#6b7280") : "#ef4444" }]}>
              -{item.currency || currency} {item.amount.toFixed(2)}
            </Text>
            {item.currency && item.currency !== 'PHP' && item.amountPHP && (
              <Text style={[styles.convertedAmount, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
                ≈ ₱{item.amountPHP.toFixed(2)}
              </Text>
            )}
          </View>
          {!isArchived && (
            <TouchableOpacity 
              onPress={() => handleDelete(item.id)} 
              accessibilityLabel="Delete expense" 
              style={styles.deleteButton}
            >
              <Feather name="trash-2" color="#ef4444" size={18} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const filteredExpenses = getExpensesByPeriod(selectedPeriod);
  const totalSpent = getTotalSpentForPeriod(selectedPeriod);
  const budgetTotal = getBudgetForPeriod(selectedPeriod);
  const remaining = budgetTotal - totalSpent;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111827" : "#f9fafb" },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? "#fff" : "#111" }]}>Expenses</Text>
      </View>

      {/* Period Selector Tabs */}
      <View style={styles.periodSelector}>
        {['today', 'week', 'month'].map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setSelectedPeriod(p)}
            style={[
              styles.periodTab,
              {
                backgroundColor: selectedPeriod === p 
                  ? (isDark ? "#2563EB" : "#3B82F6") 
                  : (isDark ? "#1f2937" : "#fff"),
                borderWidth: selectedPeriod === p ? 0 : 1,
                borderColor: isDark ? "#374151" : "#e5e7eb",
              },
            ]}
          >
            <Text
              style={[
                styles.periodTabText,
                {
                  color: selectedPeriod === p 
                    ? "#fff" 
                    : (isDark ? "#9ca3af" : "#6b7280"),
                  fontWeight: selectedPeriod === p ? "700" : "600",
                },
              ]}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Budget Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.summaryTitle, { color: isDark ? "#fff" : "#111" }]}>
            {getPeriodLabel(selectedPeriod)}
          </Text>
          <View style={[styles.periodBadge, { backgroundColor: isDark ? "#2563EB" : "#dbeafe" }]}>
            <Text style={[styles.periodBadgeText, { color: isDark ? "#fff" : "#1e40af" }]}>
              {selectedPeriod.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}> 
              Budget
            </Text>
            <Text style={[styles.summaryValue, { color: isDark ? "#fff" : "#111" }]}> 
              {currency} {budgetTotal.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Spent
            </Text>
            <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
              {currency} {totalSpent.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              Remaining
            </Text>
            <Text style={[styles.summaryValue, { color: remaining >= 0 ? "#10b981" : "#ef4444" }]}>
              {currency} {remaining.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBarBg, { backgroundColor: isDark ? "#374151" : "#e5e7eb" }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: budgetTotal > 0 ? `${Math.min((totalSpent / budgetTotal) * 100, 100)}%` : '0%',
                backgroundColor: totalSpent > budgetTotal ? "#ef4444" : "#3B82F6",
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          {budgetTotal > 0 ? `${Math.min(((totalSpent / budgetTotal) * 100), 100).toFixed(1)}% of budget used` : 'No budget set'}
        </Text>
      </View>

      {/* Expense History Section */}
      <View style={styles.historyHeader}>
        <Text style={[styles.historyTitle, { color: isDark ? "#fff" : "#111" }]}>
          Expense History
        </Text>
        <Text style={[styles.historyCount, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          {(filteredExpenses || []).length} {(filteredExpenses || []).length === 1 ? 'expense' : 'expenses'}
        </Text>
      </View>

      <SectionList
        sections={groupExpensesByDate(filteredExpenses || [])}
        keyExtractor={(item) => item?.id?.toString() || Math.random().toString()}
        renderItem={({ item }) => item ? renderExpense({ item }) : null}
        renderSectionHeader={({ section }) => {
          if (!section || !section.dateHeader) return null;
          return (
            <View style={[
              styles.dateHeader, 
              { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }
            ]}>
              <View style={styles.dateHeaderContent}>
                <Feather 
                  name={section.archived ? "archive" : "calendar"} 
                  size={16} 
                  color={isDark ? "#60a5fa" : "#3B82F6"} 
                />
                <Text style={[styles.dateHeaderText, { color: isDark ? "#fff" : "#111" }]}>
                  {section.archived ? `Expenses from ${section.dateHeader}` : section.dateHeader}
                </Text>
              </View>
              <View style={[
                styles.dateHeaderBadge,
                { backgroundColor: section.archived ? (isDark ? "#374151" : "#e5e7eb") : (isDark ? "#1e3a8a" : "#dbeafe") }
              ]}>
                <Text style={[
                  styles.dateHeaderBadgeText,
                  { color: section.archived ? (isDark ? "#9ca3af" : "#6b7280") : (isDark ? "#60a5fa" : "#3B82F6") }
                ]}>
                  {section.data?.length || 0}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={isDark ? "#374151" : "#d1d5db"} />
            <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
              No expenses for {selectedPeriod === 'today' ? 'today' : selectedPeriod === 'week' ? 'this week' : 'this month'}
            </Text>
            <Text style={[styles.emptySubtext, { color: isDark ? "#6b7280" : "#9ca3af" }]}>
              Tap the + button to add an expense
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 180 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
        stickySectionHeadersEnabled={false}
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setIsEditing(false);
          setEditingId(null);
          setNewExpense({ category: "", amount: "", period: selectedPeriod, description: '', currency: currency });
          setShowAddModal(true);
        }}
        accessibilityLabel="Add expense"
      >
        <Feather name="plus" color="#fff" size={26} />
      </TouchableOpacity>

      {showAddModal && (
        <Modal title={isEditing ? "Edit Expense" : "Add Expense"} appContext={appContext} onClose={() => {
          setShowAddModal(false);
          setIsEditing(false);
          setEditingId(null);
          setNewExpense({ category: "", amount: "", period: "today", description: "" });
          setShowCategoryDropdown(false);
          setShowNewCategoryInput(false);
        }}>
          <View>
            <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "600", fontSize: 16, marginBottom: 10 }}>Category</Text>
            
            {!showNewCategoryInput ? (
              <>
                <TouchableOpacity
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  style={[styles.input, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                >
                  <Text style={{ color: newExpense.category ? (isDark ? "#fff" : "#111") : (isDark ? "#6b7280" : "#9ca3af"), fontSize: 16 }}>
                    {newExpense.category || "Select a category"}
                  </Text>
                  <Feather name={showCategoryDropdown ? "chevron-up" : "chevron-down"} color={isDark ? "#9ca3af" : "#6b7280"} size={20} />
                </TouchableOpacity>

                {showCategoryDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb" }]}>
                    <ScrollView style={{ maxHeight: 200 }}>
                    {availableCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          setNewExpense((prev) => ({ ...prev, category: cat }));
                          setShowCategoryDropdown(false);
                        }}
                        style={styles.dropdownItem}
                      >
                        <Text style={{ color: isDark ? "#fff" : "#111", fontSize: 16 }}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={() => {
                        setShowCategoryDropdown(false);
                        setShowNewCategoryInput(true);
                        setNewExpense((prev) => ({ ...prev, category: "" }));
                      }}
                      style={[styles.dropdownItem, { borderTopWidth: 1, borderTopColor: isDark ? "#374151" : "#e5e7eb" }]}
                    >
                      <Feather name="plus" color="#3B82F6" size={18} style={{ marginRight: 8 }} />
                      <Text style={{ color: "#3B82F6", fontSize: 16, fontWeight: "600" }}>Create new category</Text>
                    </TouchableOpacity>
                    </ScrollView>
                  </View>
                )}
              </>
            ) : (
              <View>
                <TextInput
                  placeholder="Enter new category name"
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  value={newExpense.category}
                  onChangeText={(val) => setNewExpense((prev) => ({ ...prev, category: val }))}
                  style={[styles.input, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]}
                  autoFocus
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowNewCategoryInput(false);
                    setNewExpense((prev) => ({ ...prev, category: "" }));
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: "#3B82F6", fontSize: 14 }}>← Back to existing categories</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "600", fontSize: 16, marginTop: 16 }}>Apply to</Text>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {['today','week','month'].map((p) => (
                <TouchableOpacity key={p} onPress={() => setNewExpense((prev) => ({ ...prev, period: p }))} style={[styles.periodButton, { backgroundColor: (newExpense.period === p) ? '#2563eb' : (isDark ? '#0b1226' : '#f3f4f6') }] }>
                  <Text style={{ color: newExpense.period === p ? '#fff' : (isDark ? '#fff' : '#111'), fontWeight: '600' }}>{p === 'today' ? 'Today' : p === 'week' ? 'This week' : 'This month'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "600", fontSize: 16, marginTop: 16 }}>Amount</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                placeholder="Enter amount"
                keyboardType="numeric"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                value={newExpense.amount}
                onChangeText={(val) => setNewExpense((prev) => ({ ...prev, amount: val }))}
                style={[styles.input, { flex: 1, backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]}
              />
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                  style={[styles.currencyButton, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb" }]}
                >
                  <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "600", marginRight: 4 }}>{newExpense.currency}</Text>
                  <Feather name="chevron-down" size={16} color={isDark ? "#fff" : "#111"} />
                </TouchableOpacity>
                {showCurrencyDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb" }]}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                      {currencyOptions.map((curr) => (
                        <TouchableOpacity
                          key={curr}
                          onPress={() => {
                            setNewExpense((prev) => ({ ...prev, currency: curr }));
                            setShowCurrencyDropdown(false);
                          }}
                          style={styles.dropdownItem}
                        >
                          <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "500" }}>{curr}</Text>
                          {newExpense.currency === curr && <Feather name="check" size={16} color="#2563eb" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <Text style={{ color: isDark ? "#fff" : "#111", fontWeight: "600", fontSize: 16, marginTop: 16 }}>Description (optional)</Text>
            <TextInput
              placeholder="Add a short description"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              value={newExpense.description}
              onChangeText={(val) => setNewExpense((prev) => ({ ...prev, description: val }))}
              style={[styles.input, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleAddExpense}>
              <Text style={styles.saveText}>{isEditing ? "Save changes" : "Save Expense"}</Text>
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
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: { fontSize: 28, fontWeight: "700" },
  periodSelector: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  periodTabText: {
    fontSize: 14,
  },
  summaryCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  periodBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  periodBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  historyCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  expenseCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  expenseInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  expenseMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  expenseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  expenseCategory: { 
    fontSize: 16, 
    fontWeight: "700",
    flex: 1,
  },
  expenseDescription: { 
    fontSize: 13, 
    marginTop: 2,
    fontWeight: "500",
  },
  expenseDate: {
    fontSize: 12,
    marginTop: 4,
  },
  expenseAmount: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#ef4444",
    textAlign: "right",
  },
  convertedAmount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  input: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  periodButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 90,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  currencyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    minWidth: 90,
    justifyContent: "center",
  },
  dropdown: {
    position: "absolute",
    top: 50,
    right: 0,
    minWidth: 120,
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
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
    justifyContent: 'space-between',
  },
  dateHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
  },
  dateHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dateHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dateHeaderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dateHeaderBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  archivedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  archivedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});