import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBorgs } from "../context/BorgsContext";
import { supabase } from "../lib/supabase";
import { timeAgo } from "../lib/timeAgo";
import LikeButton from "./LikeButton";

// Mirrors the checks in submit_borg_name(); the database has the final say.
const MAX_NAME_LENGTH = 60;
const FUSED_BORG = /\w+borg|borg\w+/i;

// Letters and digits only, like borg_name_key(): "Sponge Borg" and "spongeborg!" are the same name.
const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

const tidy = (name) => name.replace(/\s+/g, " ").trim();

function problemWith(name, onBoard) {
  if (name.length < 3) return "Names need at least 3 characters.";
  if (!FUSED_BORG.test(name)) return 'Work "borg" into a word, like LeBorg James or Heisenborg.';
  if (onBoard.has(nameKey(name))) return "That one's already on the board. Try another.";
  return null;
}

function friendlySubmitError(error) {
  if (error.code === "23505") return "Someone already sent that one in.";
  // P0001: raised by submit_borg_name() with copy meant for the page.
  if (error.code === "P0001") return error.message;
  return "Couldn't post that. Try again.";
}

function QuotaPips({ quota }) {
  return (
    <div className="credits">
      <span className="credit-pips" aria-hidden="true">
        {Array.from({ length: quota.limit }, (_, i) => (
          <span key={i} className={`credit-pip${i < quota.remaining ? " is-full" : ""}`} />
        ))}
      </span>
      <span className="credits-text">
        {quota.remaining > 0
          ? `${quota.remaining} of ${quota.limit} left today`
          : "That's three. More at midnight UTC."}
      </span>
    </div>
  );
}

function LockedPanel() {
  return (
    <div className="label submit-label">
      <div className="label-tape" aria-hidden="true" />
      <div className="label-row">
        <span className="label-key">Members only</span>
        <p className="label-name is-locked">Three borgs a day</p>
      </div>
      <p className="ai-note">Make a free account to send in your own names for the wall.</p>
      <div className="label-actions">
        <Link to="/register" state={{ from: "/#submit" }} className="btn btn-ink">
          Sign up free
        </Link>
        <Link to="/login" state={{ from: "/#submit" }} className="btn btn-ink-ghost">
          Log in
        </Link>
      </div>
    </div>
  );
}

function OfflinePanel() {
  return (
    <div className="label submit-label">
      <div className="label-tape" aria-hidden="true" />
      <div className="label-row">
        <span className="label-key">Status</span>
        <p className="label-name is-locked">The wall is offline</p>
      </div>
      <p className="ai-note">Roll a classic while we patch it up.</p>
    </div>
  );
}

function SubmitPanel({ quota, wallRows, onPosted }) {
  const { names } = useBorgs();
  const onBoard = useMemo(() => new Set(names.map(nameKey)), [names]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const [posted, setPosted] = useState(null);
  // Removing the name takes it off the label too.
  const shown = posted && wallRows.some((row) => row.id === posted.id) ? posted.name : null;

  const name = tidy(draft);
  const outOfQuota = quota?.remaining === 0;

  const submit = async (event) => {
    event.preventDefault();
    if (posting || outOfQuota) return;

    const problem = problemWith(name, onBoard);
    if (problem) {
      setError(problem);
      return;
    }

    setPosting(true);
    setError(null);
    const { data: row, error: rpcError } = await supabase.rpc("submit_borg_name", { p_name: name });
    setPosting(false);

    if (rpcError) {
      setError(friendlySubmitError(rpcError));
      return;
    }
    setDraft("");
    setPosted(row);
    onPosted(row);
  };

  return (
    <form className="label submit-label" onSubmit={submit}>
      <div className="label-tape" aria-hidden="true" />
      <label className="label-row">
        <span className="label-key">Your borg name</span>
        <input
          className="field-input"
          type="text"
          value={draft}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Kendrick Borgmar"
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
            setPosted(null);
          }}
        />
      </label>
      <div className="label-row" aria-live="polite">
        <span className="label-key">{shown ? "Sent for review" : "Sharpied on the jug"}</span>
        <p
          key={shown ?? "draft"}
          className={`label-name${shown ? " is-set" : name ? "" : " is-empty"}`}
        >
          {shown ?? (name || "Your borg here")}
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="label-actions ai-actions">
        <button type="submit" className="btn btn-ink" disabled={posting || outOfQuota || !name}>
          {posting ? "Sending…" : "Send it in"}
        </button>
        {quota && <QuotaPips quota={quota} />}
      </div>
    </form>
  );
}

const WALL_COPY = {
  loading: "Reading the wall…",
  error: "Couldn't load the wall. Refresh to try again.",
  empty: "Nothing on the wall yet. Be the first.",
};

const STATUS_TAG = { pending: "Waiting on review", rejected: "Not approved" };

function byline(row) {
  if (row.mine) return "You";
  return row.author ?? `Account ${row.account}`;
}

function Wall({ wall, onRemove }) {
  const status = wall.status === "ready" && wall.rows.length === 0 ? "empty" : wall.status;

  return (
    <div className="wall-block">
      <div className="wall-head">
        <h3 className="wall-title">Fresh off the wall</h3>
        <p className="board-sub">Approved names from members. Like the good ones.</p>
      </div>
      {status === "ready" ? (
        <ol className="wall">
          {wall.rows.map((row) => {
            const live = row.status === "approved";
            return (
              <li className={`wall-item${live ? "" : ` is-${row.status}`}`} key={row.id}>
                {!live && <span className="chip wall-tag">{STATUS_TAG[row.status]}</span>}
                <p className="wall-name">{row.name}</p>
                <p className="wall-by">
                  {byline(row)} · {timeAgo(row.at)}
                </p>
                <div className="wall-actions">
                  {/* Unreviewed names can't be liked onto the leaderboard. */}
                  {live && <LikeButton name={row.name} from="/#submit" />}
                  {row.mine && (
                    <button
                      type="button"
                      className="wall-remove"
                      aria-label={`Remove ${row.name}`}
                      onClick={() => onRemove(row.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={`board-status wall-status${status === "loading" ? " is-loading" : ""}`} role="status">
          {WALL_COPY[status]}
        </p>
      )}
    </div>
  );
}

export default function SubmitBorg() {
  const { user, ready, online } = useAuth();
  const userId = user?.id ?? null;
  const [wall, setWall] = useState({ status: "loading", rows: [] });
  const [quota, setQuota] = useState(null);

  // Reloads when the member changes so `mine` (and the Remove buttons) follow the session.
  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.rpc("get_borg_wall").then(({ data: rows, error }) => {
      if (active) setWall(error ? { status: "error", rows: [] } : { status: "ready", rows });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    setQuota(null);
    if (!supabase || !userId) return undefined;
    let active = true;
    supabase.rpc("get_borg_submission_quota").then(({ data: next }) => {
      if (active && next) setQuota(next);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  // New names wait on review, so they join the member's own pending stickers at the front.
  const posted = useCallback(({ remaining, ...row }) => {
    setQuota((current) => current && { ...current, remaining });
    setWall((current) => ({ status: "ready", rows: [row, ...current.rows] }));
  }, []);

  const remove = useCallback(async (id) => {
    const { data: remaining, error } = await supabase.rpc("remove_borg_submission", { p_id: id });
    if (error) return;
    setQuota((current) => current && { ...current, remaining });
    setWall((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== id) }));
  }, []);

  let panel = null;
  if (!online) panel = <OfflinePanel />;
  else if (ready) {
    panel = user ? (
      <SubmitPanel quota={quota} wallRows={wall.rows} onPosted={posted} />
    ) : (
      <LockedPanel />
    );
  }

  return (
    <section id="submit" className="submit">
      <div className="wrap">
        <div className="submit-card grain">
          <div className="submit-intro">
            <h2 className="display">Name one yourself</h2>
            <p className="submit-copy">
              You definitely have the taste for BORGs if you are here, show us what you got. The best ones climb the leaderboard.
            </p>
          </div>
          {panel}
        </div>
        {online && <Wall wall={wall} onRemove={remove} />}
      </div>
    </section>
  );
}
