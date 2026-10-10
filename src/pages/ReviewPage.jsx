import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { timeAgo } from "../lib/timeAgo";

const STATUS_COPY = {
  loading: "Loading the queue…",
  error: "Couldn't load the queue. Refresh to try again.",
  empty: "Queue's clear. Nothing waiting.",
};

export default function ReviewPage() {
  const { user, ready, online, isAdmin } = useAuth();
  const [queue, setQueue] = useState({ status: "loading", rows: [] });
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    supabase.rpc("get_borg_review_queue").then(({ data, error: rpcError }) => {
      if (active) setQueue(rpcError ? { status: "error", rows: [] } : { status: "ready", rows: data });
    });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (!online) return <Navigate to="/" replace />;
  if (!ready || isAdmin === null) return null;
  if (!user) return <Navigate to="/login" state={{ from: "/review" }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const review = async (id, approve) => {
    setBusyId(id);
    setError(null);
    const { error: rpcError } = await supabase.rpc("review_borg_submission", {
      p_id: id,
      p_approve: approve,
    });
    setBusyId(null);
    if (rpcError) {
      setError("Couldn't save that review. Try again.");
      return;
    }
    // A null result means another admin got there first or the member removed it: gone either way.
    setQueue((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== id) }));
  };

  const status = queue.status === "ready" && queue.rows.length === 0 ? "empty" : queue.status;

  return (
    <AuthShell
      title="Review queue."
      lede="Member names wait here until an admin approves them. Approved names go straight to the wall."
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {status === "ready" ? (
        <ol className="review-list">
          {queue.rows.map((row) => (
            <li className="label-row review-item" key={row.id}>
              <span className="label-key">
                {row.author ?? "No name"} · {timeAgo(row.created_at)}
              </span>
              <p className="review-name">{row.name}</p>
              <p className="review-account">Account {row.user_id}</p>
              <div className="label-actions">
                <button
                  type="button"
                  className="btn btn-ink"
                  disabled={busyId !== null}
                  onClick={() => review(row.id, true)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-ink-ghost"
                  disabled={busyId !== null}
                  onClick={() => review(row.id, false)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className={`review-status${status === "loading" ? " is-loading" : ""}`} role="status">
          {STATUS_COPY[status]}
        </p>
      )}
    </AuthShell>
  );
}
