import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";

export const MOCK_AUTH_STORAGE_KEY = "jadwalin:v1:mock-auth-user";

export interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  provider: "google" | "mock";
}

type AuthSubscriber = (user: AuthUser | null) => void;

const mockSubscribers = new Set<AuthSubscriber>();

const DEFAULT_MOCK_USER: AuthUser = {
  uid: "mock-google-user",
  displayName: "Pengguna Demo",
  email: "demo@jadwalin.local",
  photoURL: null,
  provider: "mock",
};

export function getAuthMode(): "firebase" | "mock" {
  return isFirebaseConfigured() ? "firebase" : "mock";
}

function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || user.email?.split("@")[0] || "Pengguna Google",
    email: user.email?.trim() || "",
    photoURL: user.photoURL ?? null,
    provider: "google",
  };
}

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getMockAuthUser(): AuthUser | null {
  const storage = getBrowserLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(MOCK_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Partial<AuthUser>;
    if (typeof candidate.uid !== "string" || !candidate.uid.trim()) return null;

    return {
      uid: candidate.uid,
      displayName:
        typeof candidate.displayName === "string" ? candidate.displayName : "Pengguna Demo",
      email: typeof candidate.email === "string" ? candidate.email : "",
      photoURL: typeof candidate.photoURL === "string" ? candidate.photoURL : null,
      provider: "mock",
    };
  } catch {
    return null;
  }
}

function notifyMockSubscribers(user: AuthUser | null): void {
  for (const subscriber of mockSubscribers) {
    subscriber(user);
  }
}

export async function signInWithGoogle(): Promise<AuthUser> {
  if (getAuthMode() === "firebase") {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error("Firebase Authentication belum siap.");
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    return mapFirebaseUser(credential.user);
  }

  const storage = getBrowserLocalStorage();
  if (storage) {
    try {
      storage.setItem(MOCK_AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_USER));
    } catch {
      // Abaikan error quota storage lokal
    }
  }
  notifyMockSubscribers(DEFAULT_MOCK_USER);
  return DEFAULT_MOCK_USER;
}

export async function signOutUser(): Promise<void> {
  if (getAuthMode() === "firebase") {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    return;
  }

  const storage = getBrowserLocalStorage();
  if (storage) {
    try {
      storage.removeItem(MOCK_AUTH_STORAGE_KEY);
    } catch {
      // Abaikan error storage lokal
    }
  }
  notifyMockSubscribers(null);
}

/**
 * Berlangganan perubahan status login (Firebase Auth atau fallback Mock lokal).
 */
export function subscribeAuthState(callback: AuthSubscriber): () => void {
  if (getAuthMode() === "firebase") {
    const auth = getFirebaseAuth();
    if (!auth) {
      let active = true;
      queueMicrotask(() => {
        if (active) callback(null);
      });
      return () => {
        active = false;
      };
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
      callback(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
    });
  }

  let active = true;
  mockSubscribers.add(callback);

  queueMicrotask(() => {
    if (active) {
      callback(getMockAuthUser());
    }
  });

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === MOCK_AUTH_STORAGE_KEY && active) {
      callback(getMockAuthUser());
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange);
  }

  return () => {
    active = false;
    mockSubscribers.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange);
    }
  };
}
