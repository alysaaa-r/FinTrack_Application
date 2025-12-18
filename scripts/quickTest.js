// scripts/quickTest.js
// Quick test script for local Firestore integration

console.log('🧪 Quick Firestore Integration Test');
console.log('==============================');

// Test the atlasAPI service directly
const atlasAPI = require('../services/atlasAPI');

async function quickTest() {
  console.log('\\n1. Testing Firestore Connection...');
  
  try {
    const connected = await atlasAPI.testConnection();
    console.log('   Connection:', connected ? '✅ Success' : '❌ Failed');
    
    if (!connected) {
      console.log('   ⚠️ Make sure your backend is running and Firestore is configured');
      return;
    }
    
    console.log('\\n2. Testing Personal Goals...');
    
    // Test creating a goal
    const testGoal = {
      userId: 'test-user-123',
      createdBy: 'test-user-123',
      title: 'Quick Test Goal ' + Date.now(),
      targetAmount: 1000,
      currency: 'PHP',
      currentAmount: 0,
      isPersonal: true,
      contributions: [],
      createdAt: new Date().toISOString(),
    };
    
    const createResult = await atlasAPI.createPersonalGoal(testGoal);
    console.log('   Create Goal:', createResult.success ? '✅ Success' : '❌ Failed');
    if (!createResult.success) console.log('   Error:', createResult.error);
    
    // Test loading goals
    const loadResult = await atlasAPI.getPersonalGoals();
    console.log('   Load Goals:', loadResult.success ? '✅ Success' : '❌ Failed');
    console.log('   Goals Found:', loadResult.data?.length || 0);
    
    if (createResult.success && createResult.data?.id) {
      // Test deleting the goal
      const deleteResult = await atlasAPI.deletePersonalGoal(createResult.data.id);
      console.log('   Delete Goal:', deleteResult.success ? '✅ Success' : '❌ Failed');
    }
    
    console.log('\\n3. Testing Personal Expenses...');
    
    // Test creating expense
    const testExpense = {
      userId: 'test-user-123',
      category: 'Testing',
      amount: 50,
      amountPHP: 50,
      period: 'today',
      description: 'Quick test expense',
      currency: 'PHP',
      exchangeRate: 1,
      date: new Date().toISOString(),
      isPersonal: true,
    };
    
    const createExpResult = await atlasAPI.createPersonalExpense(testExpense);
    console.log('   Create Expense:', createExpResult.success ? '✅ Success' : '❌ Failed');
    
    // Test loading expenses
    const loadExpResult = await atlasAPI.getPersonalExpenses();
    console.log('   Load Expenses:', loadExpResult.success ? '✅ Success' : '❌ Failed');
    console.log('   Expenses Found:', loadExpResult.data?.length || 0);
    
    if (createExpResult.success && createExpResult.data?.id) {
      // Test deleting the expense
      const deleteExpResult = await atlasAPI.deletePersonalExpense(createExpResult.data.id);
      console.log('   Delete Expense:', deleteExpResult.success ? '✅ Success' : '❌ Failed');
    }
    
    console.log('\\n🎉 Quick test completed!');
    console.log('\\nNext steps:');
    console.log('- Use the test buttons in your React Native app');
    console.log('- Run: npm run test-firestore for comprehensive testing');
    console.log('- Check your backend logs for Firestore connection status');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\\n🔧 Troubleshooting:');
    console.log('- Make sure your backend server is running (npm start in backend folder)');
    console.log('- Check if Firebase Firestore is properly configured');
    console.log('- Verify your environment variables are set correctly');
  }
}

// Run the test
quickTest();