import { createContext, useContext, useState } from 'react';
import api from '../api/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const login = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    localStorage.setItem('token', accessToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setUser(res.data);
    } catch {

    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
