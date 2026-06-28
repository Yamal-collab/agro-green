import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Feed from "@/pages/Feed";
import Hatchery from "@/pages/Hatchery";
import Farm from "@/pages/Farm";
import Water from "@/pages/Water";
import Transfers from "@/pages/Transfers";
import Finance from "@/pages/Finance";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/hatchery" element={<Hatchery />} />
            <Route path="/farm" element={<Farm />} />
            <Route path="/water" element={<Water />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/finance" element={<Finance />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
