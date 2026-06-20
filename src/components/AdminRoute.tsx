import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import AdminSplashScreen from "./AdminSplashScreen";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <AdminSplashScreen visible />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />;

  return children;
}
