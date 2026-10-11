import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

// Emails a reset link; the link signs the member in on /reset-password.
export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const location = useLocation();
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (email) => {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const submit = (event) => {
    event.preventDefault();
    send(new FormData(event.currentTarget).get("email"));
  };

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" lede="If there's an account for that email, a reset link is on its way.">
        <div className="label-row">
          <span className="label-key">Reset link sent to</span>
          <p className="auth-sent">{sentTo}</p>
        </div>
        <p className="ai-note">Open the link in that email to pick a new password.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-switch">
          Nothing yet?{" "}
          <button type="button" className="link-button" onClick={() => send(sentTo)} disabled={busy}>
            {busy ? "Sending…" : "Send it again"}
          </button>
        </p>
        <div className="label-actions">
          <Link to="/login" state={location.state} className="btn btn-ink">
            Back to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot it?" lede="Happens to the best borgers. We'll email you a link to set a new password.">
      <form className="auth-form" onSubmit={submit}>
        <label className="label-row">
          <span className="label-key">Email</span>
          <input className="field-input" type="email" name="email" autoComplete="email" required />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="label-actions">
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </div>
        <p className="auth-switch">
          Remembered it?{" "}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
