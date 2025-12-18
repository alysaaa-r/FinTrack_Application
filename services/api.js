import { auth, db } from '../fintrack/firebase/firebase'; // Adjust path if needed
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp, 
  arrayUnion, 
  increment
} from 'firebase/firestore';

// --- FREE CURRENCY API CONFIGURATION ---
const OPEN_EXCHANGE_URL = 'https://api.exchangerate-api.com/v4/latest';

class ApiService {
  constructor() {
    // Firebase handles session automatically
  }

  // --- AUTHENTICATION ---

  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      return { 
        success: true, 
        user: {
          uid: user.uid,
          email: user.email,
          name: user.displayName || userData.name,
          ...userData
        }
      };
    } catch (error) {
      console.error("Login Error:", error);
      return { success: false, message: error.message };
    }
  }

  async signup(name, email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      const userData = {
        uid: user.uid,
        name: name,
        email: email,
        currency: "PHP", 
        theme: "light",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", user.uid), userData);

      return { success: true, user: userData };
    } catch (error) {
      console.error("Signup Error:", error);
      return { success: false, message: error.message };
    }
  }

  async logout() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // --- USER DATA ---

  async getCurrentUser() {
    const user = auth.currentUser;
    if (!user) return null;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    return userDoc.exists() ? userDoc.data() : null;
  }

  async updateUser(userId, userData) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, userData);
      return { success: true };
    } catch (error) {
      console.error("Update User Error", error);
      throw error;
    }
  }

  // --- BUDGETS ---

  async getBudgets() {
    const user = auth.currentUser;
    if (!user) return [];

    const q = query(
      collection(db, "shared_budgets"), 
      where("participants", "array-contains", user.uid)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async createBudget(budgetData) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not logged in");

    const payload = {
      ...budgetData,
      ownerId: user.uid,
      ownerName: user.displayName || "User",
      participants: [user.uid],
      createdAt: serverTimestamp(),
      currentAmount: 0,
      contributions: []
    };

    const docRef = await addDoc(collection(db, "shared_budgets"), payload);
    return { id: docRef.id, ...payload };
  }

  async deleteBudget(id) {
    await deleteDoc(doc(db, "shared_budgets", id));
    return { success: true };
  }

  // --- EXPENSES / CONTRIBUTIONS ---

  async addContribution(budgetId, contributionData) {
    const budgetRef = doc(db, "shared_budgets", budgetId);
    
    const amountChange = contributionData.type === "add" 
      ? contributionData.amountInBudgetCurrency 
      : -contributionData.amountInBudgetCurrency;

    await updateDoc(budgetRef, {
      currentAmount: increment(amountChange),
      contributions: arrayUnion({
        ...contributionData,
        id: Date.now().toString(),
        date: new Date().toISOString()
      })
    });
    return { success: true };
  }

  // --- INVITATIONS & JOINING ---
  
  async createInvitation(type, referenceId, expirationMinutes = 60) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await addDoc(collection(db, "invitations"), {
      code,
      type, // 'budget' or 'category'
      referenceId,
      expiresAt: new Date(Date.now() + expirationMinutes * 60000).toISOString(),
      createdBy: auth.currentUser.uid
    });

    return { 
      success: true, 
      invitation: { code, expiresAt: new Date(Date.now() + expirationMinutes * 60000) }
    };
  }

  async joinWithCode(code) {
    const q = query(collection(db, "invitations"), where("code", "==", code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error("Invalid code");
    
    const invite = snapshot.docs[0].data();

    if (new Date() > new Date(invite.expiresAt)) {
      throw new Error("Code expired");
    }

    const user = auth.currentUser;
    if (!user) throw new Error("Must be logged in");

    // 1. HANDLE JOINING A BUDGET (Single Budget)
    if (invite.type === 'budget') {
      const budgetRef = doc(db, "shared_budgets", invite.referenceId);
      await updateDoc(budgetRef, {
        participants: arrayUnion(user.uid),
        sharedWith: arrayUnion({
            uid: user.uid,
            name: user.displayName || "User",
            email: user.email
        })
      });
    }
    // 2. HANDLE JOINING A CATEGORY (The Fix!)
    else if (invite.type === 'category') {
      // A. Get original category info
      const originalOwnerId = invite.createdBy;
      const categoryId = invite.referenceId;
      
      const categoryRef = doc(db, "users", originalOwnerId, "categories", categoryId);
      const categorySnap = await getDoc(categoryRef);

      if (!categorySnap.exists()) {
        throw new Error("Category no longer exists");
      }

      const catData = categorySnap.data();

      // B. Create a local copy for the new user (Avoid duplicates)
      const existingCatQuery = query(
          collection(db, "users", user.uid, "categories"), 
          where("name", "==", catData.name)
      );
      const existingCatSnap = await getDocs(existingCatQuery);

      if (existingCatSnap.empty) {
          await addDoc(collection(db, "users", user.uid, "categories"), {
            name: catData.name,
            color: catData.color,
            icon: catData.icon,
            createdAt: serverTimestamp(),
            origin: "shared_invite",
            originalOwner: originalOwnerId
          });
      }

      // C. CRITICAL FIX: Find ALL existing budgets in this category and add user
      // We query budgets owned by the inviter that match this category name
      const budgetsQuery = query(
          collection(db, "shared_budgets"),
          where("ownerId", "==", originalOwnerId),
          where("category", "==", catData.name)
      );
      
      const budgetSnaps = await getDocs(budgetsQuery);

      // Update every budget found to include the new user
      const updatePromises = budgetSnaps.docs.map(budgetDoc => {
          return updateDoc(doc(db, "shared_budgets", budgetDoc.id), {
              participants: arrayUnion(user.uid), 
              sharedWith: arrayUnion({
                  uid: user.uid,
                  name: user.displayName || "User",
                  email: user.email
              })
          });
      });

      await Promise.all(updatePromises);
    }

    return { success: true, message: `Successfully joined ${invite.type}` };
  }

  // --- LIVE CURRENCY ---
  
  async getExchangeRates(baseCurrency = 'USD') {
    try {
      const response = await fetch(`${OPEN_EXCHANGE_URL}/${baseCurrency}`);
      const data = await response.json();
      return data; 
    } catch (error) {
      console.warn("Currency API Error:", error);
      return { rates: {} };
    }
  }

  async convertCurrency(amount, fromCurrency, toCurrency) {
    try {
      const response = await fetch(`${OPEN_EXCHANGE_URL}/${fromCurrency}`);
      const data = await response.json();
      const rate = data.rates[toCurrency];

      if (!rate) throw new Error(`Rate not found for ${toCurrency}`);

      return { 
        convertedAmount: amount * rate,
        rate: rate
      };
    } catch (error) {
       console.warn("Conversion failed, using fallback.");
       const fallbackRates = { 
         USD: { PHP: 56.0 }, 
         EUR: { PHP: 60.5 }, 
         PHP: { USD: 0.018 } 
       };
       const fallbackRate = fallbackRates[fromCurrency]?.[toCurrency] || 1;
       return { 
         convertedAmount: amount * fallbackRate,
         rate: fallbackRate
       };
    }
  }
}

export default new ApiService();