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
    const token = localStorage.getItem('sp_token');
    if (token) {
      api.setToken(token);
      api.getMe()
        .then(userData => {
          setUser(userData);
          localStorage.setItem('sp_user', JSON.stringify(userData));
        })
        .catch(() => {
          setUser(null);
          localStorage.removeItem('sp_user');
          localStorage.removeItem('sp_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    api.setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('sp_user', JSON.stringify(data.user));
    return data.user;
  };

  const signup = async (signupData) => {
    const data = await api.signup(signupData);
    api.setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('sp_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    localStorage.removeItem('sp_user');
    localStorage.removeItem('sp_token');
  };

  const refreshUser = async () => {
    const userData = await api.getMe();
    setUser(userData);
    localStorage.setItem('sp_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
