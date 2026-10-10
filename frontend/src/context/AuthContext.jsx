import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, session, setUnauthorizedHandler } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(session.user);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  // If the backend says the token is invalid/expired, log out automatically
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    session.save(res.access_token, res.user);
    setUser(res.user);
    return res.user;
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
