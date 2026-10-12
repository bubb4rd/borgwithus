import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logGeneratorEvent } from "../lib/generatorExperiment";
import useBorgAi from "../lib/useBorgAi";
import BorgAiLabel from "./BorgAiLabel";
import DislikeButton from "./DislikeButton";
import LikeButton from "./LikeButton";

export const MAX_THEME_LENGTH = 120;

export function CreditPips({ credits }) {
  return (
    <div className="credits">
      <span className="credit-pips" aria-hidden="true">
        {Array.from({ length: credits.limit }, (_, i) => (
          <span key={i} className={`credit-pip${i < credits.remaining ? " is-full" : ""}`} />
        ))}
      </span>
      <span className="credits-text">
        {credits.remaining > 0
          ? `${credits.remaining} of ${credits.limit} credits left today`
          : "Out of credits. They refill at midnight UTC."}
      </span>
    </div>
  );
}

function LockedPanel() {
  return (
    <div className="label ai-label">
      <div className="label-tape" aria-hidden="true" />
      <div className="label-row">
        <span className="label-key">Members only</span>
        <p className="label-name is-locked">Five AI borgs a day</p>
      </div>
      <p className="ai-note">Make a free account to unlock BORG AI. Credits refill every day.</p>
      <div className="label-actions">
        <Link
          to="/register"
          state={{ from: "/#ai" }}
          className="btn btn-ink"
          onClick={() => logGeneratorEvent("signup_click")}
        >
          Sign up free
        </Link>
        <Link to="/login" state={{ from: "/#ai" }} className="btn btn-ink-ghost">
          Log in
        </Link>
      </div>
    </div>
  );
}

function GeneratorPanel({ userId }) {
  const [theme, setTheme] = useState("");
  const { result, credits, outOfCredits, loading, error, generate } = useBorgAi(userId);

  const onSubmit = (event) => {
    event.preventDefault();
    generate(theme);
  };

  const nameState = loading ? "is-loading" : result ? "is-set" : "is-empty";

  return (
    <form className="label ai-label" onSubmit={onSubmit}>
      <div className="label-tape" aria-hidden="true" />
      <label className="label-row">
        <span className="label-key">Theme (optional)</span>
        <input
          className="field-input"
          type="text"
          value={theme}
          maxLength={MAX_THEME_LENGTH}
          placeholder="Your team, your city, finals week…"
          onChange={(event) => setTheme(event.target.value)}
        />
      </label>
      <div className="label-row" aria-live="polite">
        <span className="label-key">BORG AI says</span>
        <div className="label-result">
          <p key={loading ? "loading" : result ?? "empty"} className={`label-name ${nameState}`}>
            {loading ? "Cooking…" : result ?? "Hit generate"}
          </p>
          {result && !loading && (
            <div className="label-feedback">
              <LikeButton name={result} from="/#ai" />
              <DislikeButton name={result} />
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="label-actions ai-actions">
        <button type="submit" className="btn btn-ink" disabled={loading || outOfCredits}>
          {loading ? "Generating…" : "Generate"}
        </button>
        {credits && <CreditPips credits={credits} />}
      </div>
    </form>
  );
}

function OfflinePanel() {
  return (
    <div className="label ai-label">
      <div className="label-tape" aria-hidden="true" />
      <div className="label-row">
        <span className="label-key">Status</span>
        <p className="label-name is-locked">BORG AI is offline</p>
      </div>
      <p className="ai-note">Roll a classic while we sober it up.</p>
    </div>
  );
}

export default function AiGenerator() {
  const { user, ready, online } = useAuth();

  let panel = null;
  if (!online) panel = <OfflinePanel />;
  else if (ready) panel = user ? <GeneratorPanel userId={user.id} /> : <LockedPanel />;

  return (
    <section id="ai" className="ai-card grain">
      <div className="ai-intro">
        <h2 className="display">
          Ask <BorgAiLabel />
        </h2>
        <p className="ai-copy">
          Give it a theme, like your city, your team or the friend who always shows up late, and it
          cooks up a borg name nobody has heard yet.
        </p>
      </div>
      {panel}
    </section>
  );
}
