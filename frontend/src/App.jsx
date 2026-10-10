import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import AppLayout from "./components/layout/AppLayout.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Optimization from "./pages/Optimization.jsx";
import DataPage from "./pages/DataPage.jsx";
import NotFound from "./pages/NotFound.jsx";

// Only logged-in authority staff can see these pages
function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/optimization" element={<Optimization />} />
        <Route path="/data" element={<DataPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
