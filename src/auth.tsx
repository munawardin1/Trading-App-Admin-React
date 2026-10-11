import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth } from './firebase';

interface AuthState {
  user: User | null;
  /** True when the Firebase token carries the admin claim set by scripts/set-admin-claim.js on the server. */
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the token, e.g. right after an admin claim was added. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function readAdminClaim(user: User, force = false): Promise<boolean> {
  const { claims } = await user.getIdTokenResult(force);
  return claims.role === 'admin' || claims.isAdmin === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onIdTokenChanged(auth, async (u) => {
        setUser(u);
        setIsAdmin(u ? await readAdminClaim(u) : false);
        setLoading(false);
      }),
    [],
  );

  const value: AuthState = {
    user,
    isAdmin,
    loading,
    login: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    logout: () => signOut(auth),
    refresh: async () => {
      if (auth.currentUser) setIsAdmin(await readAdminClaim(auth.currentUser, true));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
