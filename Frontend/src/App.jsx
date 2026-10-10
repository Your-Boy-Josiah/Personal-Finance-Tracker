// ===============================================================
//  App.jsx
//  Main application entry point and router configuration.
//  Handles public/protected route separation and global context.
// ===============================================================

import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { MonthProvider } from "./context/MonthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// --- Pages ---
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Budget from "./pages/Budget";
import BudgetAdvisory from "./pages/BudgetAdvisory";
import Landing from "./pages/Landing";
import Settings from "./pages/Settings";
import Account from "./pages/Account";

// ==============================================================
// MAIN COMPONENT
// ==============================================================

function BankCallbackRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/app/account", search: location.search }} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MonthProvider>
          <BrowserRouter>
            <Routes>
          <Route path="/" element={<Landing />} />
          {/* ================================================== */}
          {/* PUBLIC ROUTES */}
          {/* ================================================== */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/bank-callback" element={<BankCallbackRedirect />} />
          
          {/* ================================================== */}
          {/* PROTECTED ROUTES (Wrapped in Layout Sidebar) */}
          {/* ================================================== */}
          <Route 
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="categories" element={<Categories />} />
            <Route path="budget" element={<Budget />} />
            
            {/* FIXED: Moved advisory route into the protected layout! */}
            <Route path="advisory" element={<BudgetAdvisory />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
          </Route>

          {/* Catch-all route for invalid URLs */}
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </MonthProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
