import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCzRKFWgvQbXLZe5efniJ49LhdZT71e-eA",
  authDomain: "tyrepro-ae716.firebaseapp.com",
  projectId: "tyrepro-ae716",
  storageBucket: "tyrepro-ae716.firebasestorage.app",
  messagingSenderId: "855053679098",
  appId: "1:855053679098:web:f13c87bf9fcff03a6a0c43",
  measurementId: "G-4WSCCMXQQG"
};
// Prevent re-initialisation during Next.js hot-reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
