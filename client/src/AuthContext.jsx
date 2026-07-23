import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ stock1_name: 'Stock 1', stock2_name: 'Stock 2' });
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await api('/api/settings'));
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api('/api/auth/me');
        setUser(user);
        await refreshSettings();
      } catch {}
      setLoading(false);
    })();
  }, [refreshSettings]);

  const login = async (username, password) => {
    const { user } = await api('/api/auth/login', { json: { username, password } });
    setUser(user);
    await refreshSettings();
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const isManager = user && (user.role === 'admin' || user.role === 'gestionnaire');
  const isAdmin = user && user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isManager, isAdmin, settings, refreshSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
