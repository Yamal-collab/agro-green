import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import Finance from "@/pages/Finance";
import Placeholder from "@/pages/Placeholder";
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
            <Route path="/suppliers" element={<Placeholder title="Suppliers" subtitle="Supplier directory, purchase ledger, outstanding & payments" />} />
            <Route path="/feed" element={<Placeholder title="Feed Trading (BU1)" subtitle="Feed catalogue, purchases, sales with weighted-average costing" />} />
            <Route path="/hatchery" element={<Placeholder title="Egg Hatchery (BU2)" subtitle="Egg purchases → incubation batches → chick sales & transfers" />} />
            <Route path="/farm" element={<Placeholder title="Own Poultry Farm (BU3)" subtitle="Birds received from hatchery, feed consumption, farm sales" />} />
            <Route path="/water" element={<Placeholder title="Water Distribution (BU4)" subtitle="Tanks, sales (no invoice), customer ledger, vehicle expenses" />} />
            <Route path="/transfers" element={<Placeholder title="Internal Transfers" subtitle="Feed BU1→BU3 and Chicks BU2→BU3 movement log" />} />
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
