import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const DASHBOARD_CACHE_KEY = "comfortsync.dashboard.snapshot";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const rawUser = localStorage.getItem("auth_user");
    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch {
        localStorage.removeItem("auth_user");
      }
    }
  }, []);

  const login = async (email, password, remember_me = false) => {
    const { data } = await api.post("/api/auth/login", {
      email,
      password,
      remember_me,
    });

    localStorage.setItem("auth_token", data.access_token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const updateUser = (nextUser) => {
    if (!nextUser) {
      localStorage.removeItem("auth_user");
      setUser(null);
      return;
    }

    localStorage.setItem("auth_user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = async () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
