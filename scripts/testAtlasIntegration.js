// scripts/testAtlasIntegration.js
// Comprehensive test script for Firestore integration

const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://your-render-app.onrender.com'; // Replace with your Render URL
const LOCAL_API_URL = 'http://localhost:5000'; // Local development

// Test user data
const testUser = {
  id: 'test-user-' + Date.now(),
  name: 'Test User',
  email: 'test@example.com'
};

// Test data
const testPersonalGoal = {
  userId: testUser.id,
  createdBy: testUser.id,
  title: 'Firestore Test Personal Goal ' + Date.now(),
  targetAmount: 5000,
  currency: 'PHP',
  currentAmount: 0,
  isPersonal: true,
  contributions: [],
  createdAt: new Date().toISOString(),
};

const testExpense = {
  userId: testUser.id,
  category: 'Testing',
  amount: 100,
  amountPHP: 100,
  period: 'today',
  description: 'Firestore integration test expense',
  currency: 'PHP',
  exchangeRate: 1,
  date: new Date().toISOString(),
  isPersonal: true,
};

const testSharedGoal = {
  userId: testUser.id,
  category: 'Test Category',
  title: 'Firestore Test Shared Goal ' + Date.now(),
  targetAmount: 10000,
  currency: 'PHP',
  ownerId: testUser.id,
  ownerName: testUser.name,
  sharedWith: [],
  contributions: [],
  createdAt: new Date().toISOString(),
  isPersonal: false,
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, useLocal = true) {
  const baseURL = useLocal ? LOCAL_API_URL : API_BASE_URL;
  const url = `${baseURL}${endpoint}`;
  
  try {
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
}

// Test functions
async function testHealthChecks() {
  console.log('\\n🏥 Testing Health Checks...');
  
  // Test basic health
  const health = await apiCall('GET', '/');
  console.log('Basic Health:', health.success ? '✅' : '❌', health.success ? health.data.message : health.error);
  
  // Test API endpoint
  const apiTest = await apiCall('GET', '/api/test');
  console.log('API Test:', apiTest.success ? '✅' : '❌', apiTest.success ? apiTest.data.message : apiTest.error);
  
  // Test database connection
  const dbTest = await apiCall('GET', '/api/test-db');
  console.log('Database Test:', dbTest.success ? '✅' : '❌', dbTest.success ? dbTest.data.message : dbTest.error);
  
  return { health, apiTest, dbTest };
}

async function testPersonalGoals() {
  console.log('\\n🎯 Testing Personal Goals...');
  
  // Create personal goal
  const create = await apiCall('POST', '/api/goals/personal', testPersonalGoal);
  console.log('Create Goal:', create.success ? '✅' : '❌', create.success ? 'Created successfully' : create.error);
  
  if (!create.success) return { create };
  
  const goalId = create.data.goal?.id || create.data.id;
  
  // Get personal goals
  const get = await apiCall('GET', '/api/goals/personal');
  console.log('Get Goals:', get.success ? '✅' : '❌', get.success ? `Found ${get.data.length} goals` : get.error);
  
  // Add contribution
  const contribution = {
    userId: testUser.id,
    userName: testUser.name,
    amount: 500,
    amountInGoalCurrency: 500,
    currency: 'PHP',
    exchangeRate: 1,
    type: 'add',
    date: new Date().toISOString(),
  };
  
  const addContrib = await apiCall('POST', `/api/goals/personal/${goalId}/contribute`, contribution);
  console.log('Add Contribution:', addContrib.success ? '✅' : '❌', addContrib.success ? 'Added ₱500' : addContrib.error);
  
  // Delete goal
  const deleteGoal = await apiCall('DELETE', `/api/goals/personal/${goalId}`);
  console.log('Delete Goal:', deleteGoal.success ? '✅' : '❌', deleteGoal.success ? 'Deleted successfully' : deleteGoal.error);
  
  return { create, get, addContrib, deleteGoal };
}

async function testPersonalExpenses() {
  console.log('\\n💰 Testing Personal Expenses...');
  
  // Create expense
  const create = await apiCall('POST', '/api/expenses/personal', testExpense);
  console.log('Create Expense:', create.success ? '✅' : '❌', create.success ? 'Created successfully' : create.error);
  
  if (!create.success) return { create };
  
  const expenseId = create.data.expense?.id || create.data.id;
  
  // Get expenses
  const get = await apiCall('GET', '/api/expenses/personal');
  console.log('Get Expenses:', get.success ? '✅' : '❌', get.success ? `Found ${get.data.length} expenses` : get.error);
  
  // Update expense
  const updateData = {
    amount: 150,
    description: 'Updated test expense'
  };
  const update = await apiCall('PUT', `/api/expenses/personal/${expenseId}`, updateData);
  console.log('Update Expense:', update.success ? '✅' : '❌', update.success ? 'Updated to ₱150' : update.error);
  
  // Delete expense
  const deleteExp = await apiCall('DELETE', `/api/expenses/personal/${expenseId}`);
  console.log('Delete Expense:', deleteExp.success ? '✅' : '❌', deleteExp.success ? 'Deleted successfully' : deleteExp.error);
  
  return { create, get, update, deleteExp };
}

async function testSharedGoals() {
  console.log('\\n🤝 Testing Shared Goals...');
  
  // Create shared goal
  const create = await apiCall('POST', '/api/goals/shared', testSharedGoal);
  console.log('Create Shared Goal:', create.success ? '✅' : '❌', create.success ? 'Created successfully' : create.error);
  
  if (!create.success) return { create };
  
  const goalId = create.data.goal?.id || create.data.id;
  
  // Get shared goals
  const get = await apiCall('GET', '/api/goals/shared');
  console.log('Get Shared Goals:', get.success ? '✅' : '❌', get.success ? `Found ${get.data.length} goals` : get.error);
  
  // Add contribution to shared goal
  const contribution = {
    userId: testUser.id,
    userName: testUser.name,
    amount: 1000,
    amountInGoalCurrency: 1000,
    currency: 'PHP',
    exchangeRate: 1,
    type: 'add',
    date: new Date().toISOString(),
  };
  
  const addContrib = await apiCall('POST', `/api/goals/shared/${goalId}/contribute`, contribution);
  console.log('Add Contribution:', addContrib.success ? '✅' : '❌', addContrib.success ? 'Added ₱1000' : addContrib.error);
  
  // Delete shared goal
  const deleteGoal = await apiCall('DELETE', `/api/goals/shared/${goalId}`);
  console.log('Delete Shared Goal:', deleteGoal.success ? '✅' : '❌', deleteGoal.success ? 'Deleted successfully' : deleteGoal.error);
  
  return { create, get, addContrib, deleteGoal };
}

async function testInvitations() {
  console.log('\\n📧 Testing Invitations...');
  
  // This would require a real shared goal, so we'll just test the endpoint existence
  const getInvites = await apiCall('GET', '/api/invitations');
  console.log('Get Invitations:', getInvites.success ? '✅' : '❌', 
    getInvites.success ? `Found ${getInvites.data?.length || 0} invitations` : getInvites.error);
  
  return { getInvites };
}

// Main test runner
async function runAllTests(useProduction = false) {
  console.log('🚀 Starting Firestore Integration Tests...');
  console.log(`📍 Testing against: ${useProduction ? 'PRODUCTION' : 'LOCAL'} environment`);
  console.log('=' .repeat(60));
  
  const results = {
    health: await testHealthChecks(),
    personalGoals: await testPersonalGoals(),
    personalExpenses: await testPersonalExpenses(),
    sharedGoals: await testSharedGoals(),
    invitations: await testInvitations(),
  };
  
  console.log('\\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  // Count successful tests
  let totalTests = 0;
  let passedTests = 0;
  
  Object.entries(results).forEach(([category, tests]) => {
    console.log(`\\n${category.toUpperCase()}:`);
    Object.entries(tests).forEach(([test, result]) => {
      totalTests++;
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${test}: ${status}`);
      if (result.success) passedTests++;
    });
  });
  
  console.log('\\n' + '='.repeat(60));
  console.log(`🎯 OVERALL: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Firestore integration is working perfectly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above and verify your setup.');
  }
  
  return results;
}

// Export for use in other scripts
module.exports = {
  runAllTests,
  testHealthChecks,
  testPersonalGoals,
  testPersonalExpenses,
  testSharedGoals,
  testInvitations
};

// Run tests if this file is executed directly
if (require.main === module) {
  const useProduction = process.argv.includes('--production');
  runAllTests(useProduction);
}