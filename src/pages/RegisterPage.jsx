import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { logGeneratorEvent } from "../lib/generatorExperiment";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const { user, ready, register, resendConfirmation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? "/";
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(null);
  const [resend, setResend] = useState("idle");

  if (ready && user) return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const password = form.get("password");

    if (password !== form.get("confirm")) {
      setError("Those passwords don't match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const needsConfirmation = await register(form.get("name").trim(), email, password);
      // The generator A/B test counts accounts made in this browser.
      logGeneratorEvent("signup");
      if (needsConfirmation) setConfirmEmail(email);
      else navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const sendAgain = async () => {
    setResend("sending");
    setError(null);
    try {
      await resendConfirmation(confirmEmail);
      setResend("sent");
    } catch (err) {
      setError(err.message);
      setResend("idle");
    }
  };

  if (confirmEmail) {
    return (
      <AuthShell title="Check your inbox" lede="One more step before you can borg with us.">
        <div className="label-row">
          <span className="label-key">Confirmation sent to</span>
          <p className="auth-sent">{confirmEmail}</p>
        </div>
        <p className="ai-note">Open the link in that email, then log in to grab your AI credits.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {resend === "sent" ? (
          <p className="form-note" role="status">
            Sent a fresh link. Check spam if it's not there in a minute.
          </p>
        ) : (
          <p className="auth-switch">
            Nothing yet?{" "}
            <button type="button" className="link-button" onClick={sendAgain} disabled={resend === "sending"}>
              {resend === "sending" ? "Sending…" : "Send it again"}
            </button>
          </p>
        )}
        <div className="label-actions">
          <Link to="/login" state={location.state} className="btn btn-ink">
            Go to log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Join the borg"
      lede="A free account unlocks BORG AI with five credits a day, three names a day on the wall, and a vote on the leaderboard."
    >
      <form className="auth-form" onSubmit={submit}>
        <label className="label-row">
          <span className="label-key">Name</span>
          <input
            className="field-input"
            type="text"
            name="name"
            autoComplete="nickname"
            maxLength={40}
            required
          />
        </label>
        <label className="label-row">
          <span className="label-key">Email</span>
          <input className="field-input" type="email" name="email" autoComplete="email" required />
        </label>
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
            {busy ? "Signing up…" : "Sign up"}
          </button>
        </div>
        <p className="auth-switch">
          Already borging?{" "}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
