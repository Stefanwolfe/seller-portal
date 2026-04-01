import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate session via cookie — no token needed, cookie is sent automatically
    api.getMe()
      .then(userData => {
        setUser(userData);
        localStorage.setItem('sp_user', JSON.stringify(userData));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('sp_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    // Cookie is set by the server response — we just store user info locally for UI
    setUser(data.user);
    localStorage.setItem('sp_user', JSON.stringify(data.user));
    return data.user;
  };

  const setUserFromResponse = (data) => {
    // Used by invite accept and password reset flows
    setUser(data.user);
    localStorage.setItem('sp_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    }
    setUser(null);
    localStorage.removeItem('sp_user');
  };

  const refreshUser = async () => {
    const userData = await api.getMe();
    setUser(userData);
    localStorage.setItem('sp_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUserFromResponse }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
