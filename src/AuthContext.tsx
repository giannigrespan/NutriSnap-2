import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, getRedirectResult } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      // Don't throw here to avoid infinite loops if rules fail
    }
  };

  useEffect(() => {
    let unsubscribe: () => void;

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("Redirect login success:", result.user.email);
        }
      })
      .catch((err) => {
        console.error("Redirect result error:", err.code, err.message);
      })
      .finally(() => {
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          setUser(user);
          if (user) {
            await fetchProfile(user.uid);
          } else {
            setProfile(null);
          }
          setLoading(false);
        });
      });

    return () => unsubscribe?.();
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
