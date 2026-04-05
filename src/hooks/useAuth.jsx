import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const USERS = {
  admin:    { password: 'Andavar@07',  role: 'admin' },
  operator: { password: 'Kvkfvns@07', role: 'operator' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('kasi_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const login = (username, password) => {
    const u = USERS[username.trim().toLowerCase()];
    if (!u || u.password !== password) throw new Error('Invalid username or password');
    const userData = { username: username.trim().toLowerCase(), role: u.role };
    sessionStorage.setItem('kasi_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
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
