import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedFirestore: Firestore | null = null;

/** Membaca konfigurasi publik Firebase dengan akses env statis agar kompatibel dengan bundling Next.js. */
export function getFirebaseConfig(): FirebaseClientConfig {
  const measurementId = (process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "").trim();

  return {
    apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim(),
    authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim(),
    storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "").trim(),
    ...(measurementId ? { measurementId } : {}),
  };
}

export function isFirebaseConfigured(config: FirebaseClientConfig = getFirebaseConfig()): boolean {
  return Boolean(
    config.apiKey.trim() &&
    config.authDomain.trim() &&
    config.projectId.trim() &&
    config.storageBucket.trim() &&
    config.messagingSenderId.trim() &&
    config.appId.trim()
  );
}

/** Mengembalikan singleton FirebaseApp atau `null` bila variabel env Firebase belum dikonfigurasi. */
export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!isFirebaseConfigured(config)) {
    return null;
  }

  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = getApps().length > 0 ? getApp() : initializeApp(config);
  return cachedApp;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (!cachedFirestore) {
    cachedFirestore = getFirestore(app);
  }
  return cachedFirestore;
}
