import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import Modal from "../components/Modal";
import api from "../services/api"; 

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function SavingsScreen({ navigation, appContext }) {
  const theme = appContext?.theme || "light";
  const currentUser = appContext?.currentUser || null;
  const currency = appContext?.currency || "PHP";
  const isDark = theme === "dark";

    // --- FIX: RESTORE UID SUPPORT ---
  // We allow either ID or UID. 
  // NOTE: If Dashboard saves to .id (and it's undefined) but this uses .uid, 
  // they won't sync. Ideally, Dashboard should also use .uid.
  const userId = currentUser?.id || currentUser?.uid;
  
  const [savingsData, setSavingsData] = useState({ total: 0, history: [], spent: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  
  // --- MODAL STATES ---
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('deposit'); // 'deposit' or 'spending'
  
  // --- CURRENCY & AMOUNT STATES ---
  const [amountInput, setAmountInput] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [isConverting, setIsConverting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
    setSelectedCurrency(currency);
  }, [currency]);

  // --- LOAD DATA (LOCAL STORAGE) ---
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSavings();
    });
    
    // Initial load
    loadSavings();
    
    return unsubscribe;
  }, [navigation, userId]); 

  const loadSavings = async () => {
    // Check if user exists before trying to load
    if (!userId) {
        console.log("SavingsScreen: Waiting for user login...");
        return;
    }
    
    try {
        const storageKey = `savings_history_${userId}`;
        console.log("SavingsScreen: Loading from", storageKey); // Debug log

        const storedHistory = await AsyncStorage.getItem(storageKey);
        const history = storedHistory ? JSON.parse(storedHistory) : [];

        // Logic: Calculate Total Saved (Positive amounts)
        const totalSaved = history
            .filter(item => parseFloat(item.amount) > 0)
            .reduce((sum, item) => sum + parseFloat(item.amount), 0);

        // Logic: Calculate Total Spent (Negative amounts)
        const totalSpent = history
            .filter(item => parseFloat(item.amount) < 0)
            .reduce((sum, item) => sum + Math.abs(parseFloat(item.amount)), 0);

        setSavingsData({
            total: totalSaved, 
            spent: totalSpent, 
            history: history.sort((a, b) => new Date(b.date) - new Date(a.date))
        });
        
    } catch (error) {
        console.error("Error loading savings:", error);
        setSavingsData({ total: 0, history: [], spent: 0 });
    }
  };

  // --- REAL-TIME CONVERSION ---
  useEffect(() => {
    const calculateConversion = async () => {
      if (!amountInput || isNaN(parseFloat(amountInput))) {
        setConvertedAmount("");
        setExchangeRate(1);
        return;
      }

      const rawAmount = parseFloat(amountInput);

      if (selectedCurrency === currency) {
        setConvertedAmount(rawAmount.toFixed(2));
        setExchangeRate(1);
        return;
      }

      setIsConverting(true);
      try {
        const result = await api.convertCurrency(rawAmount, selectedCurrency, currency);
        if (result && result.convertedAmount) {
            setConvertedAmount(result.convertedAmount.toFixed(2));
            setExchangeRate(result.rate);
        }
      } catch (error) {
        console.warn("Conversion failed", error);
      } finally {
        setIsConverting(false);
      }
    };

    calculateConversion();
  }, [amountInput, selectedCurrency, currency]);

  // --- HANDLE TRANSACTION (Add or Spend) ---
  const handleTransaction = async () => {
    const val = parseFloat(amountInput);
    
    if (!val || val <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    if (!userId) {
        Alert.alert("Error", "User not identified. Cannot save.");
        return;
    }

    let finalAmount = val;
    
    if (selectedCurrency !== currency) {
        if (!convertedAmount) {
             Alert.alert("Please Wait", "Currency conversion in progress...");
             return;
        }
        finalAmount = parseFloat(convertedAmount);
    }

    // Spending Validation
    if (transactionType === 'spending') {
        const available = (savingsData.total || 0) - (savingsData.spent || 0);
        if (finalAmount > available) {
            Alert.alert("Insufficient Savings", `You only have ${currency} ${available.toFixed(2)} available.`);
            return;
        }
    }

    setIsProcessing(true);

    try {
      // 1. Create Record
      const newRecord = {
        id: Date.now().toString(),
        amount: transactionType === 'spending' ? -finalAmount : finalAmount,
        originalAmount: val,
        originalCurrency: selectedCurrency,
        exchangeRate: exchangeRate,
        type: transactionType, 
        period: transactionType === 'spending' ? 'spending' : 'deposit',
        title: transactionType === 'spending' 
            ? (selectedCurrency !== currency ? `Spent ${selectedCurrency} ${val}` : 'Withdrawn from savings')
            : (selectedCurrency !== currency ? `Added ${selectedCurrency} ${val}` : 'Manual Deposit'),
        date: new Date().toISOString(),
      };

      // 2. Save to Local Storage
      const storageKey = `savings_history_${userId}`;
      const storedHistory = await AsyncStorage.getItem(storageKey);
      const currentHistory = storedHistory ? JSON.parse(storedHistory) : [];
      const updatedHistory = [...currentHistory, newRecord];

      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedHistory));
        
      // Cleanup
      setShowTransactionModal(false);
      setAmountInput('');
      setSelectedCurrency(currency);
      setConvertedAmount("");
      
      // Refresh UI
      await loadSavings();

      Alert.alert("Success", `${transactionType === 'spending' ? 'Spent' : 'Added'} ${currency} ${finalAmount.toFixed(2)}`);

    } catch (error) {
        console.error("Transaction Error:", error);
        Alert.alert("Error", "Failed to record transaction locally.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSavings();
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatDate = (dateString) => {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
    } catch (e) {
        return "Invalid Date";
    }
  };

  // --- CHART LOGIC ---
  const getBarChartData = () => {
    const now = new Date();
    const data = [];
    const allTransactions = savingsData.history;

    const periods = selectedPeriod === 'today' ? 7 : selectedPeriod === 'week' ? 4 : 6;

    for (let i = periods - 1; i >= 0; i--) {
        let label = "";
        let netAmount = 0;
        
        if (selectedPeriod === 'today') {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toDateString();
            label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            netAmount = allTransactions
                .filter(item => new Date(item.date).toDateString() === dateKey)
                .reduce((sum, item) => sum + parseFloat(item.amount), 0);
        } 
        else if (selectedPeriod === 'week') {
             const weekStart = new Date(now);
             weekStart.setDate(weekStart.getDate() - (i * 7));
             const weekEnd = new Date(weekStart);
             weekEnd.setDate(weekStart.getDate() + 6);
             label = `W${4-i}`;
             
             netAmount = allTransactions
                .filter(item => {
                    const d = new Date(item.date);
                    return d >= weekStart && d <= weekEnd;
                })
                .reduce((sum, item) => sum + parseFloat(item.amount), 0);
        } 
        else if (selectedPeriod === 'month') {
             const month = new Date(now);
             month.setMonth(month.getMonth() - i);
             label = month.toLocaleDateString('en-US', { month: 'short' });
             
             netAmount = allTransactions
                .filter(item => {
                    const d = new Date(item.date);
                    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
                })
                .reduce((sum, item) => sum + parseFloat(item.amount), 0);
        }
        
        data.push({ label, value: netAmount });
    }
    return data;
  };

  const barChartData = getBarChartData();
  const maxBarValue = Math.max(...barChartData.map(d => Math.abs(d.value)), 100);

  // Open Modal Helper
  const openModal = (type) => {
      setTransactionType(type);
      setAmountInput('');
      setSelectedCurrency(currency);
      setConvertedAmount('');
      setShowTransactionModal(true);
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
          <Ionicons name="arrow-back" size={24} color={isDark ? "#fff" : "#111"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? "#fff" : "#111" }]}>
          My Savings
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10b981"]} tintColor="#10b981" />
        }
      >
        {/* Total Savings Card */}
        <View style={[styles.totalCard, { backgroundColor: isDark ? "#065f46" : "#10b981" }]}>
          <View style={styles.totalCardContent}>
            <MaterialIcons name="monetization-on" size={48} color="#fff" />
            <View style={styles.totalTextContainer}>
              <Text style={styles.totalLabel}>Total Savings</Text>
              <Text style={styles.totalAmount}>
                {currency} {((savingsData.total || 0) - (savingsData.spent || 0)).toFixed(2)}
              </Text>
              <Text style={styles.totalSubtext}>
                From {savingsData.history.filter(h => parseFloat(h.amount) > 0).length} deposits
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={[styles.spendingCard, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
            <View style={styles.spendingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.spendingTitle, { color: isDark ? "#fff" : "#111" }]}>Manage Savings</Text>
                <Text style={[styles.spendingSubtext, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                   Add or withdraw funds
                </Text>
              </View>
              
              {/* ADD SAVINGS BUTTON */}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: "#10b981", marginRight: 8 }]}
                onPress={() => openModal('deposit')}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.spendButtonText}>Add</Text>
              </TouchableOpacity>

              {/* SPEND BUTTON */}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: (savingsData.spent || 0) > 0 ? "#ef4444" : "#f59e0b" }]}
                onPress={() => openModal('spending')}
              >
                <Feather name="trending-down" size={16} color="#fff" />
                <Text style={styles.spendButtonText}>Spend</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.spendingStats}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Spent</Text>
                <Text style={[styles.statValue, { color: "#ef4444" }]}>-{currency} {(savingsData.spent || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: isDark ? "#9ca3af" : "#6b7280" }]}>Available</Text>
                <Text style={[styles.statValue, { color: "#10b981" }]}>{currency} {(savingsData.total - (savingsData.spent || 0)).toFixed(2)}</Text>
              </View>
            </View>
        </View>

        {/* Chart Section */}
        <View style={[styles.card, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
            <View style={styles.periodBreakdownHeader}>
                <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#111" }]}>Timeline</Text>
                <View style={{flexDirection:'row', gap:5}}>
                    {['today','month'].map(p => (
                        <TouchableOpacity key={p} onPress={()=>setSelectedPeriod(p)} style={{padding:6, backgroundColor: selectedPeriod===p ? (isDark ? '#065f46' : '#d1fae5') : 'transparent', borderRadius:6}}>
                            <Text style={{color: selectedPeriod===p ? (isDark ? '#fff' : '#10b981') : (isDark ? '#888' : '#6b7280'), fontSize:10, textTransform:'uppercase', fontWeight:'700'}}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
            
            <View style={styles.barsRow}>
                {barChartData.map((d, i) => {
                    const isNeg = d.value < 0;
                    const heightPct = maxBarValue > 0 ? (Math.abs(d.value) / maxBarValue) * 100 : 0;
                    return (
                        <TouchableOpacity key={i} style={styles.barItem} onPress={() => Alert.alert(d.label, `Net: ${d.value < 0 ? '-' : '+'}${currency} ${Math.abs(d.value).toFixed(2)}`)}>
                             <View style={{
                                 width: 14, 
                                 height: `${Math.max(heightPct, 5)}%`, 
                                 backgroundColor: isNeg ? '#ef4444' : '#10b981',
                                 borderRadius: 4
                             }} />
                             <Text style={{fontSize:9, color: isDark ? '#9ca3af' : '#6b7280', marginTop:6}}>{d.label}</Text>
                        </TouchableOpacity>
                    )
                })}
            </View>
        </View>

        {/* History List */}
        <View style={[styles.card, { backgroundColor: isDark ? "#1f2937" : "#fff" }]}>
            <Text style={[styles.cardTitle, { color: isDark ? "#fff" : "#111", marginBottom: 15 }]}>Recent History</Text>
            {savingsData.history.length === 0 ? (
                 <Text style={{color: isDark ? "#6b7280" : "#9ca3af", textAlign:'center', padding:20, fontStyle:'italic'}}>No history yet</Text>
            ) : (
                savingsData.history.slice(0, 10).map((item, i) => (
                    <View key={i} style={{flexDirection:'row', justifyContent:'space-between', paddingVertical:12, borderBottomWidth:1, borderColor: isDark ? '#374151' : '#f3f4f6'}}>
                        <View style={{flex: 1}}>
                            <Text style={{color: isDark ? '#fff' : '#111', fontWeight:'600', fontSize: 14}} numberOfLines={1}>{item.title || (parseFloat(item.amount) > 0 ? 'Deposit' : 'Spent')}</Text>
                            <Text style={{color: isDark ? "#9ca3af" : "#6b7280", fontSize:11, marginTop: 2}}>{formatDate(item.date)}</Text>
                        </View>
                        <View style={{alignItems:'flex-end', justifyContent: 'center'}}>
                             <Text style={{color: parseFloat(item.amount) < 0 ? '#ef4444' : '#10b981', fontWeight:'700', fontSize: 14}}>
                                {parseFloat(item.amount) < 0 ? '' : '+'}{currency} {Math.abs(parseFloat(item.amount)).toFixed(2)}
                             </Text>
                             {item.originalCurrency && item.originalCurrency !== currency && (
                                <Text style={{color: isDark ? "#6b7280" : "#9ca3af", fontSize:10}}>
                                   ({item.originalCurrency} {Math.abs(item.originalAmount).toFixed(2)})
                                </Text>
                             )}
                        </View>
                    </View>
                ))
            )}
        </View>
        
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: isDark ? "#1e3a8a" : "#dbeafe" }]}>
          <Feather name="info" size={20} color={isDark ? "#60a5fa" : "#1e40af"} />
          <Text style={[styles.infoText, { color: isDark ? "#93c5fd" : "#1e40af" }]}>
            Leftover budget from each period is automatically saved here. Set your budgets in the Dashboard to start saving!
          </Text>
        </View>
      </ScrollView>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <Modal
          title={transactionType === 'deposit' ? "Add Savings" : "Spend from Savings"}
          appContext={appContext}
          onClose={() => {
            setShowTransactionModal(false);
            setAmountInput('');
          }}
        >
          <View>
            <Text style={{ color: isDark ? "#9ca3af" : "#6b7280", fontSize: 14, marginBottom: 16 }}>
               {transactionType === 'spending' ? (
                   <>Available: <Text style={{color: "#10b981", fontWeight: "700"}}>{currency} {(savingsData.total - savingsData.spent).toFixed(2)}</Text></>
               ) : (
                   "Add money to your savings balance"
               )}
            </Text>
            
             <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                <View style={{flex: 1}}>
                    <Text style={{color: isDark ? "#fff" : "#000", marginBottom: 5, fontWeight: '600'}}>Currency</Text>
                    <TouchableOpacity 
                        onPress={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                        style={[styles.modalInput, {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb"}]}
                    >
                        <Text style={{color: isDark ? "#fff" : "#000"}}>{selectedCurrency}</Text>
                        <Feather name="chevron-down" size={20} color={isDark ? "#fff" : "#000"} />
                    </TouchableOpacity>
                </View>
                <View style={{flex: 2}}>
                    <Text style={{color: isDark ? "#fff" : "#000", marginBottom: 5, fontWeight: '600'}}>Amount</Text>
                    <TextInput
                      placeholder="0.00"
                      placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                      keyboardType="numeric"
                      value={amountInput}
                      onChangeText={setAmountInput}
                      style={[styles.modalInput, { backgroundColor: isDark ? "#1f2937" : "#fff", borderColor: isDark ? "#374151" : "#e5e7eb", color: isDark ? "#fff" : "#111" }]}
                    />
                </View>
             </View>

             {showCurrencyDropdown && (
                <View style={{maxHeight: 150, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: isDark ? '#222' : '#fff'}}>
                    <ScrollView nestedScrollEnabled>
                        {currencies.map(curr => (
                            <TouchableOpacity 
                                key={curr.code} 
                                style={{padding: 12, borderBottomWidth: 1, borderColor: '#eee'}}
                                onPress={() => { setSelectedCurrency(curr.code); setShowCurrencyDropdown(false); }}
                            >
                                <Text style={{color: isDark ? '#fff' : '#000'}}>{curr.code} - {curr.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
             )}

             {convertedAmount && selectedCurrency !== currency && (
                 <View style={{backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff', padding: 10, borderRadius: 8, marginBottom: 20}}>
                     <Text style={{color: '#3B82F6', fontSize: 13}}>
                        ≈ {currency} {convertedAmount} 
                        <Text style={{fontSize: 11, color: '#888'}}> (Rate: {exchangeRate.toFixed(4)})</Text>
                     </Text>
                 </View>
             )}

            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: transactionType === 'spending' ? "#ef4444" : "#10b981", opacity: isProcessing ? 0.6 : 1 }]} 
              onPress={handleTransaction}
              disabled={isProcessing}
            >
              {isProcessing ? (
                  <ActivityIndicator color="#fff" />
              ) : (
                  <>
                    <Feather name={transactionType === 'spending' ? "trending-down" : "plus-circle"} size={18} color="#fff" />
                    <Text style={styles.modalButtonText}>{transactionType === 'spending' ? "Confirm Spending" : "Add Savings"}</Text>
                  </>
              )}
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  totalCard: { marginBottom: 20, borderRadius: 20, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  totalCardContent: { flexDirection: "row", alignItems: "center", gap: 20 },
  totalTextContainer: { flex: 1 },
  totalLabel: { color: "rgba(255, 255, 255, 0.9)", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  totalAmount: { color: "#fff", fontSize: 32, fontWeight: "700", marginBottom: 4 },
  totalSubtext: { color: "rgba(255, 255, 255, 0.8)", fontSize: 13, fontWeight: "500" },
  card: { marginBottom: 20, borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 20 },
  spendingCard: { marginBottom: 20, borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  spendingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  spendingTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  spendingSubtext: { fontSize: 13, fontWeight: "500" },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  spendButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  spendButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  spendingStats: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statBox: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: "rgba(0, 0, 0, 0.02)" },
  statLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: "700" },
  spendingProgressContainer: { marginTop: 12 },
  spendingProgressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  spendingProgressFill: { height: "100%", borderRadius: 4 },
  spendingPercentage: { fontSize: 12, fontWeight: "600", marginTop: 6, textAlign: "right" },
  modalInput: { borderWidth: 2, borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 20 },
  modalButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  modalButtonText: { color: "#fff", fontSize: 16, textAlign: "center", fontWeight: "600" },
  periodBreakdownHeader: { flexDirection: "row", justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionSubtitle: { fontSize: 12 },
  breakdownIconBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  barsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 150 },
  barItem: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 2 },
  infoCard: { marginBottom: 20, borderRadius: 12, padding: 16, flexDirection: "row", gap: 12 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: "500" },
});