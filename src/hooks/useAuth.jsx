import { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

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

// Role assignment by email — add new emails here to grant access
const ROLE_MAP = {
  'slnaiyar@gmail.com':    'admin',
  'kvkfvns@gmail.com':     'operator',
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true); // true while Firebase checks auth state

  // Listen for Firebase auth state — handles page reload automatically
  useEffect(() => {
    return onAuthStateChanged(fbAuth, (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email?.toLowerCase() || '';
        const assignedRole = ROLE_MAP[email] || 'operator';
        setUser({ email, uid: firebaseUser.uid });
        setRole(assignedRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (email, password) => {
    await signInWithEmailAndPassword(fbAuth, email.trim().toLowerCase(), password);
    // onAuthStateChanged above will update user/role automatically
  };

  const logout = async () => {
    try { await signOut(fbAuth); } catch (e) { console.error('SignOut error:', e); }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAdmin: role === 'admin',
      login,
      logout,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
