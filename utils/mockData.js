// utils/mockData.js

// In-memory mock data (temporary; would normally be saved to a database)
export const mockUsers = [];
export const mockBudgets = {};
export const mockExpenses = {};
export const mockGoals = {};
export const invitationCodes = {};
export const mockGoalCategories = {}; // Separate categories for goals only (not budget tracking)
export const mockSharedGoalCategories = {}; // Categories for shared goals only
export const mockSharedBudgetCategories = {}; // Categories for shared budgets only
export const mockSavings = {}; // { userId: { total: number, history: [{amount, period, date, budgetTotal, spent}], spent: number } }
export const mockSharedGoals = {}; // { goalId: { id, title, targetAmount, currentAmount, category, ownerId, ownerName, sharedWith: [userIds], contributions: [], createdAt } }
export const mockSharedBudgets = {}; // { budgetId: { id, title, targetAmount, currentAmount, category, ownerId, ownerName, sharedWith: [userIds], contributions: [], createdAt } }
