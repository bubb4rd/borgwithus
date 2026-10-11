import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, ready, logIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? "/";
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await logIn(form.get("email"), form.get("password"));
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      lede="Log in to like names, post your own and spend your daily BORG AI credits."
    >
      <form className="auth-form" onSubmit={submit}>
        <label className="label-row">
          <span className="label-key">Email</span>
          <input className="field-input" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="label-row">
          <span className="label-key">Password</span>
          <input
            className="field-input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="label-actions">
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </div>
        <p className="auth-switch">
          New here?{" "}
          <Link to="/register" state={location.state}>
            Make an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
