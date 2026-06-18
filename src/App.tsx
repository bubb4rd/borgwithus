import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import GeneratorPage from "./pages/GeneratorPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import SettingsPage from "./pages/SettingsPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SignupConfirmPage from "./pages/SignupConfirmPage";
import AdminRoute from "./components/AdminRoute";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/generator" element={<GeneratorPage />} />
        <Route
          path="/dashboard/ai"
          element={<Navigate to="/dashboard/generator" replace />}
        />
        <Route path="/dashboard/leaderboard" element={<LeaderboardPage />} />
        <Route path="/dashboard/history" element={<HistoryPage />} />
        <Route path="/dashboard/settings" element={<SettingsPage />} />
        <Route
          path="/dashboard/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/confirm" element={<SignupConfirmPage />} />
      </Routes>
    </BrowserRouter>
  );
}
