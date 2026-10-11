import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { authLinkError } from "../lib/supabase";

export default function LoginPage() {
  const { user, ready, logIn, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? "/";
  // A failed confirmation link lands here; its reason only belongs to the page it opened.
  const [error, setError] = useState(location.key === "default" ? authLinkError : null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null);
  const [resend, setResend] = useState("idle");
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    setBusy(true);
    setError(null);
    setUnconfirmedEmail(null);
    setResend("idle");
    try {
      await logIn(email, form.get("password"));
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.unconfirmed) setUnconfirmedEmail(email);
      setBusy(false);
    }
  };

  const sendAgain = async () => {
    setResend("sending");
    try {
      await resendConfirmation(unconfirmedEmail);
      setResend("sent");
    } catch (err) {
      setError(err.message);
      setResend("idle");
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
        {unconfirmedEmail &&
          (resend === "sent" ? (
            <p className="form-note" role="status">
              Sent a new confirmation link to {unconfirmedEmail}.
            </p>
          ) : (
            <p className="auth-switch">
              Lost the email?{" "}
              <button type="button" className="link-button" onClick={sendAgain} disabled={resend === "sending"}>
                {resend === "sending" ? "Sending…" : "Send it again"}
              </button>
            </p>
          ))}
        <div className="label-actions">
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </div>
        <p className="auth-switch">
          <Link to="/forgot-password" state={location.state}>
            Forgot your password?
          </Link>
        </p>
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
