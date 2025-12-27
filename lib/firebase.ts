import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate that required config values are present
const isConfigValid = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// Initialize Firebase (works on both client and server)
if (!isConfigValid()) {
  if (typeof window !== "undefined") {
    console.error(
      "Firebase configuration is missing required values. Please check your .env.local file."
    );
  }
} else {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    if (typeof window !== "undefined") {
      console.error("Error initializing Firebase:", error);
    }
  }
}

// Helper function to get auth with error handling
export const getAuthInstance = (): Auth => {
  if (!auth) {
    throw new Error(
      "Firebase Auth is not initialized. Please check your Firebase configuration."
    );
  }
  return auth;
};

// Helper function to get db with error handling
export const getDbInstance = (): Firestore => {
  if (!db) {
    throw new Error(
      "Firestore is not initialized. Please check your Firebase configuration."
    );
  }
  return db;
};

export { auth, db };
export default app;
