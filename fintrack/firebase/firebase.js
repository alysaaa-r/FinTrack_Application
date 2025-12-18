import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth"; 
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Use process.env to read the keys you set in eas.json
// ... imports ...

const firebaseConfig = {
  // PASTE YOUR REAL KEYS HERE DIRECTLY
  apiKey: "AIzaSyBqO7uTl6JwZbb0UpmnhNlnWTMA6DvieWg",
  authDomain: "fintrack-d6f85.firebaseapp.com",
  projectId: "fintrack-d6f85",
  storageBucket: "fintrack-d6f85.firebasestorage.app",
  messagingSenderId: "697461615478",
  appId: "1:697461615478:web:0af84eac9d1fd06b186857",
  measurementId: "G-CD8N08QMR7"
};


const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const storage = getStorage(app);