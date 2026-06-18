import { useState, type ReactNode } from "react";
import ScrollHintList from "./ScrollHintList";
import type { AdminLikeRow, AdminRatingRow } from "../lib/adminStats";

const LIST_HEIGHT = 302;

type CommunityView = "ratings" | "likes";

function CommunityTable({
  empty,
  headers,
  rows,
  refreshKey,
}: {
  empty: string;
  headers: string[];
  rows: ReactNode[][];
  refreshKey: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-subtle">{empty}</p>;
  }

  return (
    <ScrollHintList height={LIST_HEIGHT} refreshDeps={[rows.length, refreshKey]}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border bg-elevated/60">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-subtle"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr
                key={i}
                className="border-b border-border/60 last:border-b-0"
              >
                {cells.map((cell, j) => (
                  <td key={j} className="px-5 py-2 text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ScrollHintList>
  );
}

export default function AdminCommunityPanel({
  ratings,
  likes,
}: {
  ratings: AdminRatingRow[];
  likes: AdminLikeRow[];
}) {
  const [view, setView] = useState<CommunityView>("ratings");

  return (
    <section className="dashboard-panel overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <label className="flex flex-wrap items-center gap-2">
          <span className="sr-only">Community data view</span>
          <select
            value={view}
            onChange={(event) => setView(event.target.value as CommunityView)}
            className="cursor-pointer rounded-xl border border-border bg-input px-3 py-2 text-sm font-bold text-foreground outline-none transition-colors focus:border-cyan/40"
            aria-label="Community data view"
          >
            <option value="ratings">Community ratings</option>
            <option value="likes">Likes</option>
          </select>
        </label>
      </div>

      {view === "ratings" ? (
        <CommunityTable
          refreshKey="ratings"
          empty="No ratings recorded yet."
          headers={["Borg name", "Average", "Count"]}
          rows={ratings.map((row) => [
            row.name,
            <span className="tabular-nums">{row.average.toFixed(1)} ★</span>,
            <span className="tabular-nums">{row.count}</span>,
          ])}
        />
      ) : (
        <CommunityTable
          refreshKey="likes"
          empty="No likes recorded yet."
          headers={["Borg name", "Likes"]}
          rows={likes.map((row) => [
            row.name,
            <span className="tabular-nums">{row.likes}</span>,
          ])}
        />
      )}
    </section>
  );
}
