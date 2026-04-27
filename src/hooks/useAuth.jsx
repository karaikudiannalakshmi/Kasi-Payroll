import { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, signOut } from 'firebase/auth';

const AuthContext = createContext(null);

// Firebase Auth instance (reuse existing app if already initialized)
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const fbAuth = getAuth(app);

const USERS = {
  admin:    { password: import.meta.env.VITE_ADMIN_PASSWORD,    role: 'admin' },
  operator: { password: import.meta.env.VITE_OPERATOR_PASSWORD, role: 'operator' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('kasi_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Re-authenticate anonymously on page reload if session exists
  useEffect(() => {
    const saved = sessionStorage.getItem('kasi_user');
    if (saved && !fbAuth.currentUser) {
      signInAnonymously(fbAuth).catch(e => console.error('Re-auth failed:', e));
    }
  }, []);

  const login = async (username, password) => {
    const u = USERS[username.trim().toLowerCase()];
    if (!u || u.password !== password) throw new Error('Invalid username or password');
    try {
      if (!fbAuth.currentUser) await signInAnonymously(fbAuth);
    } catch (e) {
      console.error('Firebase anon auth failed:', e);
    }
    const userData = { username: username.trim().toLowerCase(), role: u.role };
    sessionStorage.setItem('kasi_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try { await signOut(fbAuth); } catch (e) { console.error('SignOut error:', e); }
    sessionStorage.removeItem('kasi_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role || null,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      loading: false,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
