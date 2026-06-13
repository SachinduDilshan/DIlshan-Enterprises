"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  appUser: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser]           = useState<AppUser | null>(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    // Safety timeout — never let loading hang forever
    const timeout = setTimeout(() => setLoading(false), 8000);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);

      if (unsubProfile) { unsubProfile(); unsubProfile = undefined; }

      if (user) {
        unsubProfile = onSnapshot(
          doc(db, "users", user.uid),
          (snap) => {
            setAppUser(snap.exists() ? ({ uid: user.uid, ...snap.data() } as AppUser) : null);
            setLoading(false);
            clearTimeout(timeout);
          },
          () => {
            // Firestore read failed — don't hang forever
            setAppUser(null);
            setLoading(false);
            clearTimeout(timeout);
          }
        );
      } else {
        setAppUser(null);
        setLoading(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireRole(role: AppUser["role"]) {
  const { appUser, loading } = useAuth();
  const isAllowed = !loading && appUser?.role === role;
  return { isAllowed, loading };
}