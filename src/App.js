import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import { BorgsProvider } from './context/BorgsContext';
import { DislikesProvider } from './context/DislikesContext';
import { LikesProvider } from './context/LikesContext';
import HomePage from './pages/HomePage';
import AdminPage from './pages/admin/AdminPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ReviewPage from './pages/ReviewPage';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <BorgsProvider>
          <DislikesProvider>
            <LikesProvider>
              <div className="App">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/review" element={<ReviewPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </LikesProvider>
          </DislikesProvider>
        </BorgsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
