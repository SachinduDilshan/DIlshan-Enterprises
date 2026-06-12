"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
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
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Fetch the role and profile from Firestore /users/{uid}
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setAppUser({ uid: snap.id, ...snap.data() } as AppUser);
        }
      } else {
        setAppUser(null);
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
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
            if (snap.exists()) {
              setAppUser({ uid: user.uid, ...snap.data() } as AppUser);
            } else {
              setAppUser(null);
            }
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

  return { firebaseUser, appUser, loading };
}

export function useRequireRole(role: AppUser["role"]) {
  const { appUser, loading } = useAuth();
  const isAllowed = !loading && appUser?.role === role;
  return { isAllowed, loading };
}
