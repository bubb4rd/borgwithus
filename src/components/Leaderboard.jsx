import React from "react";
import { useLikes } from "../context/LikesContext";
import LikeButton from "./LikeButton";

const STATUS_COPY = {
  loading: "Counting likes…",
  error: "Couldn't load the leaderboard. Refresh to try again.",
  offline: "The leaderboard is offline right now.",
  empty: "No likes yet. Roll a borg and be the first.",
};

export default function Leaderboard() {
  const { leaderboard } = useLikes();
  const { rows } = leaderboard;
  const status = leaderboard.status === "ready" && rows.length === 0 ? "empty" : leaderboard.status;

  return (
    <section id="leaderboard" className="leaderboard">
      <div className="wrap">
        <div className="section-head board-head">
          <h2 className="display">Top borgs</h2>
          <p className="board-sub">Likes</p>
        </div>

        {status === "ready" ? (
          <ol className="board">
            {rows.map((row, i) => (
              <li className="board-row" key={row.name}>
                <span className="board-rank">{String(i + 1).padStart(2, "0")}</span>
                <span className="board-name">{row.name}</span>
                <LikeButton name={row.name} count={row.likes} from="/#leaderboard" />
              </li>
            ))}
          </ol>
        ) : (
          <p className={`board-status${status === "loading" ? " is-loading" : ""}`} role="status">
            {STATUS_COPY[status]}
          </p>
        )}
      </div>
    </section>
  );
}
