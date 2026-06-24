import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "aiza-dummy-key-for-local-dev",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "civicsense-ai-91b4.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "civicsense-ai-91b4",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "civicsense-ai-91b4.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Use emulator when running locally
if (typeof window !== "undefined" && window.location.hostname === "localhost") {
  // Wrap in try-catch because in Next.js hot-reloading can re-run this block and throw errors if emulators are already connected.
  try {
    // Only connect if the emulator has not been connected yet
    // Firestore connection
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    // Auth connection
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    // Storage connection
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    // Functions connection
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    console.log("Firebase client connected to emulators.");
  } catch (e) {
    console.log("Firebase emulators already initialized or connection failed:", e);
  }
}

export { app, auth, db, storage, functions };
