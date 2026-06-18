import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import DashboardNavbar from "./DashboardNavbar";
import ScrollToTop from "./ScrollToTop";
import { useAuth } from "../context/AuthContext";

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="dashboard-bg min-h-screen">
      <DashboardNavbar />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        {children}
      </main>
      <ScrollToTop />
    </div>
  );
}
