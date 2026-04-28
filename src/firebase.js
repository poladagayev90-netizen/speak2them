import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDtRxLBGOpiXkDiy_v7m6UMmi96E1rg098",
  authDomain: "speak2them-64f2b.firebaseapp.com",
  projectId: "speak2them-64f2b",
  storageBucket: "speak2them-64f2b.firebasestorage.app",
  messagingSenderId: "8439038995",
  appId: "1:8439038995:web:9a9a7e7f7fce90d3c8abe6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;