// scripts/smokeTest.js
// Simple smoke test that simulates a signup/login and checks mockBudgets/mockExpenses
const path = require('path');
const mockData = require(path.join(__dirname, '..', 'utils', 'mockData.js'));

function resetMocks() {
  mockData.mockUsers.length = 0;
  Object.keys(mockData.mockBudgets).forEach(k => delete mockData.mockBudgets[k]);
  Object.keys(mockData.mockExpenses).forEach(k => delete mockData.mockExpenses[k]);
  Object.keys(mockData.mockGoals).forEach(k => delete mockData.mockGoals[k]);
}

function run() {
  console.log('Starting smoke test...');
  resetMocks();

  const testUser = { id: 12345, name: 'Test', phone: '000', password: 'pass' };
  mockData.mockUsers.push(testUser);

  console.log('Before login:', {
    budgets: Object.keys(mockData.mockBudgets).length,
    expenses: Object.keys(mockData.mockExpenses).length,
  });

  // Simulate login behavior from LoginScreen
  if (!mockData.mockBudgets[testUser.id]) {
    mockData.mockBudgets[testUser.id] = {
      today: { total: 0, spent: 0 },
      week: { total: 0, spent: 0 },
      month: { total: 0, spent: 0 },
    };
    mockData.mockExpenses[testUser.id] = [];
    mockData.mockGoals[testUser.id] = [];
  }

  console.log('After login:', {
    budgets: Object.keys(mockData.mockBudgets).length,
    expenses: Object.keys(mockData.mockExpenses).length,
  });

  // Add an expense
  const expense = { id: Date.now(), category: 'Food', amount: 12.5, date: new Date().toISOString() };
  mockData.mockExpenses[testUser.id].push(expense);
  mockData.mockBudgets[testUser.id].today.spent += expense.amount;

  console.log('After adding expense:', {
    budgetsForUser: mockData.mockBudgets[testUser.id],
    expensesForUser: mockData.mockExpenses[testUser.id].length,
  });

  console.log('Smoke test complete.');
}

run();
