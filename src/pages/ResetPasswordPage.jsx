import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { authLinkError } from "../lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

// Where a reset link lands: the link has signed the member in, so they pick a new password here.
// Without a session (expired or reused link, or opened directly) it points back to
// /forgot-password.
export default function ResetPasswordPage() {
  const { user, ready, updatePassword } = useAuth();
  const location = useLocation();
  const linkError = location.key === "default" ? authLinkError : null;
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    if (password !== form.get("confirm")) {
      setError("Those passwords don't match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  if (!ready) return <AuthShell title="New password" lede="Checking your link…" />;

  if (done) {
    return (
      <AuthShell title="All set" lede="Your new password works from now on.">
        <div className="label-actions">
          <Link to="/" className="btn btn-ink">
            Back to the borgs
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell title="New password" lede="Reset links work once and expire after a while.">
        <p className="form-error" role="alert">
          {linkError ?? "Open the reset link from your email to set a new password."}
        </p>
        <div className="label-actions">
          <Link to="/forgot-password" className="btn btn-ink">
            Get a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="New password" lede={`Pick a new password for ${user.email}.`}>
      <form className="auth-form" onSubmit={submit}>
        <div className="field-pair">
          <label className="label-row">
            <span className="label-key">Password</span>
            <input
              className="field-input"
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>
          <label className="label-row">
            <span className="label-key">Confirm</span>
            <input
              className="field-input"
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="label-actions">
          <button type="submit" className="btn btn-ink" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
