import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import api from '../services/api';

const POPULAR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CNY', 'KRW'];

export default function CurrencyRateWidget({ theme = 'light' }) {
  const isDark = theme === 'dark';
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Get data from the new API
      const response = await api.getExchangeRates();
      
      // 2. CRITICAL FIX: Check for 'rates' directly (The free API doesn't use 'success: true')
      if (response && response.rates) {
        setRates(response.rates);
        
        // The free API sends time as a unix timestamp (seconds)
        const timestamp = response.time_last_updated ? response.time_last_updated * 1000 : Date.now();
        setLastUpdated(new Date(timestamp));
      } else {
        // If 'rates' is missing, something went wrong
        console.log("Invalid API Response:", response);
        setError('Failed to load rates');
      }
    } catch (err) {
      console.error('Error fetching exchange rates:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // Auto-refresh every hour
    const interval = setInterval(fetchRates, 3600000);
    return () => clearInterval(interval);
  }, []);

  const formatRate = (rate) => {
    if (!rate) return '0.00';
    if (rate < 1) return rate.toFixed(4);
    return rate.toFixed(2);
  };

  // 3. Calculate PHP Equivalent using USD as base
  const getPhpEquivalent = (currency) => {
    if (!rates) return null;
    
    // The Free API Base is always USD
    const phpRate = rates['PHP']; 
    const targetRate = rates[currency];

    if (!phpRate || !targetRate) return null;

    // Cross-rate calculation: (1 / Target) * PHP
    const rate = (1 / targetRate) * phpRate;
    
    return formatRate(rate);
  };

  const getTimeAgo = () => {
    if (!lastUpdated) return '';
    const now = new Date();
    const diff = Math.floor((now - lastUpdated) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return lastUpdated.toLocaleDateString();
  };

  if (loading && !rates) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0f1724' : '#fff' }]}>
        <View style={styles.header}>
            <MaterialIcons name="currency-exchange" size={20} color={isDark ? '#3B82F6' : '#2563eb'} />
            <Text style={[styles.title, { color: isDark ? '#fff' : '#0f172a' }]}>Currency Rates</Text>
        </View>
        <ActivityIndicator size="small" color={isDark ? '#3B82F6' : '#2563eb'} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0f1724' : '#fff' }]}>
        <View style={styles.header}>
          <MaterialIcons name="currency-exchange" size={20} color={isDark ? '#3B82F6' : '#2563eb'} />
          <Text style={[styles.title, { color: isDark ? '#fff' : '#0f172a' }]}>Currency Rates</Text>
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={16} color="#ef4444" />
          <Text style={[styles.errorText, { color: isDark ? '#fca5a5' : '#dc2626' }]}>{error}</Text>
        </View>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: isDark ? '#1e293b' : '#f3f4f6' }]} onPress={fetchRates}>
          <Text style={{ color: isDark ? '#3B82F6' : '#2563eb', fontSize: 14, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayCurrencies = expanded ? POPULAR_CURRENCIES : POPULAR_CURRENCIES.slice(0, 4);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0f1724' : '#fff' }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="currency-exchange" size={20} color={isDark ? '#3B82F6' : '#2563eb'} />
          <Text style={[styles.title, { color: isDark ? '#fff' : '#0f172a' }]}>Currency Rates</Text>
        </View>
        <TouchableOpacity onPress={fetchRates} disabled={loading}>
          <Feather name="refresh-cw" size={16} color={loading ? '#9ca3af' : (isDark ? '#3B82F6' : '#2563eb')} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
        Live rates to PHP • {getTimeAgo()}
      </Text>

      <View style={styles.ratesContainer}>
        {displayCurrencies.map((curr) => (
          <View key={curr} style={[styles.rateRow, { borderBottomColor: isDark ? '#1e293b' : '#f3f4f6' }]}>
            <View style={styles.currencyInfo}>
              <Text style={[styles.currencyCode, { color: isDark ? '#fff' : '#0f172a' }]}>{curr}</Text>
              <View style={styles.conversionRow}>
                <Text style={[styles.conversionText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>1 {curr} =</Text>
                <Text style={[styles.rateValue, { color: isDark ? '#3B82F6' : '#2563eb' }]}>₱{getPhpEquivalent(curr)}</Text>
              </View>
            </View>
            <View style={[styles.badge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
              <Feather name="trending-up" size={12} color={isDark ? '#60a5fa' : '#2563eb'} />
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.expandButton} onPress={() => setExpanded(!expanded)}>
        <Text style={{ color: isDark ? '#3B82F6' : '#2563eb', fontSize: 13, fontWeight: '600' }}>
          {expanded ? 'Show Less' : `Show ${POPULAR_CURRENCIES.length - 4} More`}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? '#3B82F6' : '#2563eb'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  ratesContainer: {
    gap: 12,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversionText: {
    fontSize: 13,
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
});