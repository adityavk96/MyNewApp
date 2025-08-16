// src/firebaseConfig.js
// Make sure this file is in src/ and NOT inside components/

// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAxHZeTDr94S7cbBah9RZd0-5XBV_EBxK4",
  authDomain: "ishika-gst.firebaseapp.com",
  projectId: "ishika-gst",
  storageBucket: "ishika-gst.appspot.com",
  messagingSenderId: "691326701729",
  appId: "1:691326701729:web:19f09c850e85babdb8e0e0",
  measurementId: "G-M72SCMXWDF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
