// src/firebaseConfig.js
// Make sure this file is in src/ and NOT inside components/

// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

 // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDDq1xP9O0qAt32iFwgtH-AWqhKwyaumC4",
    authDomain: "rate-93e55.firebaseapp.com",
    projectId: "rate-93e55",
    storageBucket: "rate-93e55.firebasestorage.app",
    messagingSenderId: "146828869368",
    appId: "1:146828869368:web:52417b2af652c3d045450d"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
