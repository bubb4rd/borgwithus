import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import DashboardNavbar from "./DashboardNavbar";
import ScrollToTop from "./ScrollToTop";
import { useAuth } from "../context/AuthContext";

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="dashboard-bg flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="dashboard-bg min-h-screen overflow-x-hidden">
      <DashboardNavbar />
      <main
        key={user.id}
        className="site-container min-w-0 px-4 py-8 md:px-8 md:py-10"
      >
        {children}
      </main>
      <ScrollToTop />
    </div>
  );
}
