import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage      from "./pages/LoginPage";
import RegisterPage   from "./pages/RegisterPage";
import AdminDashboard from "./pages/AdminDashboard";

import SecurityLogs from "./pages/admin/SecurityLogs";
import LiveSecurityLogs from "./pages/admin/LiveSecurityLogs";
import Incidents from "./pages/admin/Incidents";
import AnalystIncidents from "./pages/analyst/Incidents";
import IncidentInvestigation from "./pages/analyst/IncidentInvestigation";
import VerifyReport from "./pages/VerifyReport";
import DashboardLayout from "./layouts/DashboardLayout";

/* ── Loading Spinner ── */
const FullPageSpinner = () => (
  <div style={{
    minHeight: "100vh", display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "var(--bg-primary)",
  }}>
    <div style={{
      width: 42, height: 42,
      border: "3px solid var(--border-subtle)",
      borderTopColor: "var(--color-gold)",
      borderRadius: "50%",
      animation: "spin 0.7s linear infinite",
    }} />
  </div>
);

/* ── Temporary placeholder for non-admin/analyst dashboard ── */
const DashboardPlaceholder = () => {
  const { user } = useAuth();

  if (user?.role === "Analyst") {
    return <Navigate to="/analyst/incidents" replace />;
  }

  if (user?.role === "Admin") {
    return <Navigate to="/admin-dashboard" replace />;
  }

  return (
    <DashboardLayout title="Portal">
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 16,
        padding: "3rem 2rem",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "1.5rem", maxWidth: 600, margin: "2rem auto",
        boxShadow: "var(--shadow-card)",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: "var(--color-gold-soft)",
          border: "1px solid var(--color-gold-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-gold)", fontSize: "1.75rem",
        }}>
          🛡️
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "0.5rem", fontFamily: "var(--font-heading)" }}>
            Welcome, {user?.name} 👋
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            Role: <strong style={{ color: "var(--color-gold)" }}>{user?.role}</strong> · Security Telemetry & Forensics Portal
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

/* ── Protected Route — any authenticated user ── */
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/* ── Admin-Only Route — must be authenticated + Admin role ── */
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "Admin") return <Navigate to="/dashboard" replace />;
  return children;
};

/* ── Analyst / Admin Route — must be authenticated + Analyst or Admin role ── */
const AnalystRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "Analyst" && user?.role !== "Admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

/* ── Guest Route — redirect logged-in users to their correct dashboard ── */
const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return children;
  if (user?.role === "Admin") return <Navigate to="/admin-dashboard" replace />;
  if (user?.role === "Analyst") return <Navigate to="/analyst/incidents" replace />;
  return <Navigate to="/dashboard" replace />;
};

/* ── App ── */
function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={
        <GuestRoute><LoginPage /></GuestRoute>
      } />

      <Route path="/register" element={
        <GuestRoute><RegisterPage /></GuestRoute>
      } />

      {/* Regular user dashboard */}
      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPlaceholder /></PrivateRoute>
      } />

      {/* Admin-only dashboard */}
      <Route path="/admin-dashboard" element={
        <AdminRoute><AdminDashboard /></AdminRoute>
      } />

      {/* Admin-only organization management route */}
      <Route path="/admin/organizations" element={
        <AdminRoute><AdminDashboard /></AdminRoute>
      } />

      {/* Admin Real-Time Live Security Logs route */}
      <Route path="/admin/live-security-logs" element={
        <AdminRoute><LiveSecurityLogs /></AdminRoute>
      } />

      {/* Admin Real-Time Security Logs route */}
      <Route path="/admin/security-logs" element={
        <AdminRoute><SecurityLogs /></AdminRoute>
      } />

      {/* Admin Incident Management routes */}
      <Route path="/admin/incidents" element={
        <AdminRoute><Incidents /></AdminRoute>
      } />
      <Route path="/admin/incidents/:id" element={
        <AdminRoute><Incidents /></AdminRoute>
      } />

      {/* Analyst Incident Management & Investigation routes */}
      <Route path="/analyst/incidents" element={
        <AnalystRoute><AnalystIncidents /></AnalystRoute>
      } />
      <Route path="/analyst/incidents/:id" element={
        <AnalystRoute><IncidentInvestigation /></AnalystRoute>
      } />

      {/* Public Report Verification (QR Scan / Public Portal) */}
      <Route path="/verify/:reportNumber" element={<VerifyReport />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;