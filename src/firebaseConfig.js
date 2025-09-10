// src/firebaseConfig.js
// Make sure this file is in src/ and NOT inside components/

// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

   // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyADeyKqxPhn-2saYmU7xYHrO9X61hFrHnk",
    authDomain: "milkrates.firebaseapp.com",
    projectId: "milkrates",
    storageBucket: "milkrates.firebasestorage.app",
    messagingSenderId: "59115845629",
    appId: "1:59115845629:web:889f55d091b9a89c374b94"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
