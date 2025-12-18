// screens/TestScreen.js
// Dedicated testing screen for Firestore integration

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import atlasAPI from '../services/atlasAPI';

export default function TestScreen({ appContext }) {
  const theme = appContext?.theme || 'light';
  const currentUser = appContext?.currentUser || { id: 'test-user-123', name: 'Test User' };
  const isDark = theme === 'dark';

  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test, success, message) => {
    setTestResults(prev => [...prev, {
      test,
      success,
      message,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const runFullTest = async () => {
    setIsRunning(true);
    clearResults();
    
    try {
      // Test 1: Connection
      addResult('Connection Test', false, 'Testing...');
      const connected = await atlasAPI.testConnection();
      setTestResults(prev => prev.map(r => 
        r.test === 'Connection Test' 
          ? { ...r, success: connected, message: connected ? 'Connected successfully' : 'Connection failed' }
          : r
      ));

      if (!connected) {
        addResult('Overall Result', false, 'Cannot continue - no connection');
        setIsRunning(false);
        return;
      }

      // Test 2: Personal Goals
      addResult('Personal Goals', false, 'Testing CRUD operations...');
      const testGoal = {
        userId: currentUser.id,
        createdBy: currentUser.id,
        title: `Test Goal ${Date.now()}`,
        targetAmount: 1000,
        currency: 'PHP',
        currentAmount: 0,
        isPersonal: true,
        contributions: [],
        createdAt: new Date().toISOString(),
      };

      const createGoal = await atlasAPI.createPersonalGoal(testGoal);
      let goalTestMessage = createGoal.success ? 'Create ✅' : 'Create ❌';

      if (createGoal.success) {
        const loadGoals = await atlasAPI.getPersonalGoals();
        goalTestMessage += loadGoals.success ? ', Load ✅' : ', Load ❌';

        // Test contribution
        const contribution = {
          userId: currentUser.id,
          userName: currentUser.name,
          amount: 100,
          amountInGoalCurrency: 100,
          currency: 'PHP',
          exchangeRate: 1,
          type: 'add',
          date: new Date().toISOString(),
        };

        const addContrib = await atlasAPI.addPersonalGoalContribution(createGoal.data.id, contribution);
        goalTestMessage += addContrib.success ? ', Contribute ✅' : ', Contribute ❌';

        // Clean up
        const deleteGoal = await atlasAPI.deletePersonalGoal(createGoal.data.id);
        goalTestMessage += deleteGoal.success ? ', Delete ✅' : ', Delete ❌';
      }

      setTestResults(prev => prev.map(r => 
        r.test === 'Personal Goals' 
          ? { ...r, success: createGoal.success, message: goalTestMessage }
          : r
      ));

      // Test 3: Personal Expenses
      addResult('Personal Expenses', false, 'Testing CRUD operations...');
      const testExpense = {
        userId: currentUser.id,
        category: 'Testing',
        amount: 50,
        amountPHP: 50,
        period: 'today',
        description: `Test expense ${Date.now()}`,
        currency: 'PHP',
        exchangeRate: 1,
        date: new Date().toISOString(),
        isPersonal: true,
      };

      const createExpense = await atlasAPI.createPersonalExpense(testExpense);
      let expenseTestMessage = createExpense.success ? 'Create ✅' : 'Create ❌';

      if (createExpense.success) {
        const loadExpenses = await atlasAPI.getPersonalExpenses();
        expenseTestMessage += loadExpenses.success ? ', Load ✅' : ', Load ❌';

        // Clean up
        const deleteExpense = await atlasAPI.deletePersonalExpense(createExpense.data.id);
        expenseTestMessage += deleteExpense.success ? ', Delete ✅' : ', Delete ❌';
      }

      setTestResults(prev => prev.map(r => 
        r.test === 'Personal Expenses' 
          ? { ...r, success: createExpense.success, message: expenseTestMessage }
          : r
      ));

      // Test 4: Shared Goals
      addResult('Shared Goals', false, 'Testing CRUD operations...');
      const testSharedGoal = {
        userId: currentUser.id,
        category: 'Test Category',
        title: `Test Shared Goal ${Date.now()}`,
        targetAmount: 2000,
        currency: 'PHP',
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        sharedWith: [],
        contributions: [],
        createdAt: new Date().toISOString(),
        isPersonal: false,
      };

      const createSharedGoal = await atlasAPI.createSharedGoal(testSharedGoal);
      let sharedTestMessage = createSharedGoal.success ? 'Create ✅' : 'Create ❌';

      if (createSharedGoal.success) {
        const loadSharedGoals = await atlasAPI.getSharedGoals();
        sharedTestMessage += loadSharedGoals.success ? ', Load ✅' : ', Load ❌';

        // Clean up
        const deleteSharedGoal = await atlasAPI.deleteSharedGoal(createSharedGoal.data.id);
        sharedTestMessage += deleteSharedGoal.success ? ', Delete ✅' : ', Delete ❌';
      }

      setTestResults(prev => prev.map(r => 
        r.test === 'Shared Goals' 
          ? { ...r, success: createSharedGoal.success, message: sharedTestMessage }
          : r
      ));

      // Overall result
      const allTests = [connected, createGoal.success, createExpense.success, createSharedGoal.success];
      const passedTests = allTests.filter(Boolean).length;
      addResult('Overall Result', passedTests === allTests.length, 
        `${passedTests}/${allTests.length} tests passed`);

    } catch (error) {
      addResult('Overall Result', false, `Test failed: ${error.message}`);
    }

    setIsRunning(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111' : '#f5f5f5' }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
          🧪 Firestore Tests
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#666' }]}>
          Test all Firestore integration functions
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
            Quick Tests
          </Text>
          
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: isRunning ? '#6b7280' : '#10b981' }]}
            onPress={runFullTest}
            disabled={isRunning}
          >
            <Feather name={isRunning ? 'loader' : 'play'} size={20} color="white" />
            <Text style={styles.testButtonText}>
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: '#ef4444' }]}
            onPress={clearResults}
          >
            <Feather name="trash-2" size={20} color="white" />
            <Text style={styles.testButtonText}>Clear Results</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
            Test Results
          </Text>
          
          {testResults.length === 0 ? (
            <Text style={[styles.noResults, { color: isDark ? '#9ca3af' : '#666' }]}>
              No tests run yet. Click "Run All Tests" to begin.
            </Text>
          ) : (
            testResults.map((result, index) => (
              <View key={index} style={[styles.resultItem, { 
                backgroundColor: result.success ? '#dcfce7' : '#fee2e2',
                borderLeftColor: result.success ? '#10b981' : '#ef4444'
              }]}>
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultTest, { 
                    color: result.success ? '#059669' : '#dc2626' 
                  }]}>
                    {result.success ? '✅' : '❌'} {result.test}
                  </Text>
                  <Text style={styles.resultTime}>{result.timestamp}</Text>
                </View>
                <Text style={[styles.resultMessage, { 
                  color: result.success ? '#047857' : '#b91c1c' 
                }]}>
                  {result.message}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, { backgroundColor: isDark ? '#1f2937' : '#fff' }]}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#000' }]}>
            Manual Tests
          </Text>
          <Text style={[styles.instructions, { color: isDark ? '#9ca3af' : '#666' }]}>
            You can also test individual functions using the test buttons in:
          </Text>
          <Text style={[styles.instructionItem, { color: isDark ? '#60a5fa' : '#2563eb' }]}>
            • Budget Screen (Personal Goals)
          </Text>
          <Text style={[styles.instructionItem, { color: isDark ? '#60a5fa' : '#2563eb' }]}>
            • Expenses Screen (Personal Expenses)
          </Text>
          <Text style={[styles.instructionItem, { color: isDark ? '#60a5fa' : '#2563eb' }]}>
            • Shared Goals Screen (Shared Goals)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  testButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  noResults: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  resultItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  resultMessage: {
    fontSize: 14,
  },
  instructions: {
    fontSize: 14,
    marginBottom: 8,
  },
  instructionItem: {
    fontSize: 14,
    marginBottom: 4,
  },
});