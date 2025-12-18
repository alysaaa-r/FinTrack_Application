// utils/helpers.js

// Utility for handling input changes easily
export const handleInputChange = (setter) => (name, value) => {
  setter((prev) => ({ ...prev, [name]: value }));
};

// Generate a random 6-character invitation code
export const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Save leftover budget to savings
export const saveBudgetLeftover = (userId, period, mockBudgets, mockSavings, mockExpenses) => {
  if (!userId || !mockBudgets[userId] || !mockBudgets[userId][period]) {
    return 0;
  }

  const budget = mockBudgets[userId][period];
  const leftover = budget.total - budget.spent;

  if (leftover > 0) {
    // Initialize savings structure if needed
    if (!mockSavings[userId]) {
      mockSavings[userId] = { total: 0, history: [] };
    }

    // Add to total savings
    mockSavings[userId].total += leftover;

    // Add to history
    mockSavings[userId].history.push({
      amount: leftover,
      period: period,
      budgetTotal: budget.total,
      spent: budget.spent,
      date: new Date().toISOString(),
    });

    // Archive expenses for this period by marking them with an archiveDate
    if (mockExpenses && mockExpenses[userId]) {
      const currentDate = new Date().toISOString();
      mockExpenses[userId] = mockExpenses[userId].map(expense => {
        if (expense.period === period && !expense.archived) {
          return { ...expense, archived: true, archiveDate: currentDate };
        }
        return expense;
      });
    }

    // Reset all category spent amounts to 0
    if (mockBudgets[userId].categories) {
      Object.keys(mockBudgets[userId].categories).forEach(categoryName => {
        mockBudgets[userId].categories[categoryName].spent = 0;
      });
    }

    // Reset the budget for the period - both total and spent
    mockBudgets[userId][period].spent = 0;
    mockBudgets[userId][period].total = 0;

    return leftover;
  }

  return 0;
};
