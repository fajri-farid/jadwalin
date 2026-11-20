"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getAuthMode,
  signInWithGoogle,
  signOutUser,
  subscribeAuthState,
  type AuthUser,
} from "@/lib/firebase/auth";
import { getScheduleRepository } from "@/lib/repositories/schedule-repository";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isFirebaseMode: boolean;
  error: string | null;
  signIn: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirebaseMode = getAuthMode() === "firebase";

  useEffect(() => {
    const unsubscribe = subscribeAuthState((nextUser) => {
      setUser(nextUser);
      setIsLoading(false);

      if (nextUser) {
        void getScheduleRepository()
          .ensureUserProfile({
            uid: nextUser.uid,
            displayName: nextUser.displayName,
            email: nextUser.email,
          })
          .catch(() => {
            // Sinkronisasi profil bersifat non-blocking saat sesi baru terbaca
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (): Promise<AuthUser | null> => {
    setError(null);
    try {
      const signedInUser = await signInWithGoogle();
      return signedInUser;
    } catch (err) {
      setError(extractErrorMessage(err, "Gagal masuk dengan akun Google."));
      return null;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await signOutUser();
    } catch (err) {
      setError(extractErrorMessage(err, "Gagal keluar dari sesi saat ini."));
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isFirebaseMode,
      error,
      signIn,
      signOut,
      clearError,
    }),
    [user, isLoading, isFirebaseMode, error, signIn, signOut, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth wajib dipanggil di dalam <AuthProvider>.");
  }
  return context;
}
