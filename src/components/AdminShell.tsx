import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import AdminNavbar from "./AdminNavbar";
import AdminSplashScreen from "./AdminSplashScreen";
import ScrollToTop from "./ScrollToTop";
import { useAuth } from "../context/AuthContext";

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AdminSplashScreen visible />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="admin-bg min-h-screen">
      <AdminNavbar />
      <main key={user.id} className="dashboard-main">
        {children}
      </main>
      <ScrollToTop className="!bottom-[4.75rem]" />
    </div>
  );
}
