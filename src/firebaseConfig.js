// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // <-- Import getFirestore here


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyADeyKqxPhn-2saYmU7xYHrO9X61hFrHnk",
  authDomain: "milkrates.firebaseapp.com",
  projectId: "milkrates",
  storageBucket: "milkrates.firebasestorage.app",
  messagingSenderId: "59115845629",
  appId: "1:59115845629:web:889f55d091b9a89c374b94"
};


// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Firebase Authentication instance
const auth = getAuth(app);

// Firestore database instance
const db = getFirestore(app);

export { auth, db };