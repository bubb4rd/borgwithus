import { useEffect, useMemo, useState, type ReactNode } from "react";
import ScrollHintList from "./ScrollHintList";
import SelectMenu from "./SelectMenu";
import {
  ADMIN_LIST_FILTER_ROW_CLASS,
  ADMIN_LIST_PANEL_CLASS,
  ADMIN_LIST_PANEL_HEADER_CLASS,
  ADMIN_LIST_TABLE_CLASS,
} from "../lib/adminListLayout";
import type { AdminLikeRow, AdminRatingRow } from "../lib/adminStats";

const COMMUNITY_OPTIONS = [
  { value: "ratings" as const, label: "Community ratings" },
  { value: "likes" as const, label: "Likes" },
];

const COMPARE_OPTIONS = [
  { value: "gt" as const, label: "greater than" },
  { value: "lt" as const, label: "less than" },
];

type CommunityView = (typeof COMMUNITY_OPTIONS)[number]["value"];
type CompareOp = (typeof COMPARE_OPTIONS)[number]["value"];

const filterInputClass =
  "h-8 w-[4.25rem] rounded-lg border border-border bg-input px-2 text-sm tabular-nums text-foreground outline-none focus:border-foreground/30";

function FilterIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

function passesThreshold(value: number, op: CompareOp, threshold: string) {
  const trimmed = threshold.trim();
  if (!trimmed) return true;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return true;

  return op === "gt" ? value > parsed : value < parsed;
}

function CompareFilter({
  label,
  operator,
  onOperatorChange,
  value,
  onValueChange,
  stacked = false,
}: {
  label: string;
  operator: CompareOp;
  onOperatorChange: (op: CompareOp) => void;
  value: string;
  onValueChange: (value: string) => void;
  stacked?: boolean;
}) {
  return (
    <label
      className={`flex text-xs font-semibold uppercase tracking-wide text-subtle ${
        stacked
          ? "flex-col items-stretch gap-2"
          : "h-8 items-center gap-1.5 whitespace-nowrap"
      }`}
    >
      <span>{label}</span>
      <span className={`flex items-center gap-1.5 ${stacked ? "w-full" : ""}`}>
        <SelectMenu
          value={operator}
          onChange={onOperatorChange}
          options={COMPARE_OPTIONS}
          ariaLabel={`${label} comparison`}
          triggerClassName="flex h-8 items-center text-xs font-semibold normal-case tracking-normal"
        />
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-label={`${label} filter value`}
          className={`${filterInputClass} normal-case tracking-normal ${
            stacked ? "w-full" : ""
          }`}
        />
      </span>
    </label>
  );
}

function CommunityFilters({
  view,
  avgOp,
  avgValue,
  countOp,
  countValue,
  likesOp,
  likesValue,
  onAvgOpChange,
  onAvgValueChange,
  onCountOpChange,
  onCountValueChange,
  onLikesOpChange,
  onLikesValueChange,
  stacked = false,
}: {
  view: CommunityView;
  avgOp: CompareOp;
  avgValue: string;
  countOp: CompareOp;
  countValue: string;
  likesOp: CompareOp;
  likesValue: string;
  onAvgOpChange: (op: CompareOp) => void;
  onAvgValueChange: (value: string) => void;
  onCountOpChange: (op: CompareOp) => void;
  onCountValueChange: (value: string) => void;
  onLikesOpChange: (op: CompareOp) => void;
  onLikesValueChange: (value: string) => void;
  stacked?: boolean;
}) {
  if (view === "ratings") {
    return (
      <>
        <CompareFilter
          label="Average"
          operator={avgOp}
          onOperatorChange={onAvgOpChange}
          value={avgValue}
          onValueChange={onAvgValueChange}
          stacked={stacked}
        />
        <CompareFilter
          label="Count"
          operator={countOp}
          onOperatorChange={onCountOpChange}
          value={countValue}
          onValueChange={onCountValueChange}
          stacked={stacked}
        />
      </>
    );
  }

  return (
    <CompareFilter
      label="Likes"
      operator={likesOp}
      onOperatorChange={onLikesOpChange}
      value={likesValue}
      onValueChange={onLikesValueChange}
      stacked={stacked}
    />
  );
}

function CommunityFiltersModal({
  open,
  onClose,
  view,
  filters,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  view: CommunityView;
  filters: ReactNode;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:hidden">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onClose}
        aria-label="Close filters"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-filters-title"
        className="admin-modal-panel relative w-full max-w-sm rounded-[1.35rem] border border-[var(--dash-border)] p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3
              id="community-filters-title"
              className="text-lg font-bold text-[var(--dash-foreground)]"
            >
              Filters
            </h3>
            <p className="mt-1 text-sm text-[var(--dash-muted)]">
              {view === "ratings" ? "Community ratings" : "Likes"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--dash-border)] text-[var(--dash-muted)] transition hover:bg-elevated/60 hover:text-[var(--dash-foreground)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4">{filters}</div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer text-sm font-semibold text-subtle transition hover:text-foreground"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 cursor-pointer items-center rounded-full bg-[var(--dash-foreground)] px-4 text-sm font-semibold text-[var(--admin-bg-page)] transition hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

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
    return (
      <p className="flex flex-1 items-start px-5 py-6 text-sm text-subtle">
        {empty}
      </p>
    );
  }

  return (
    <ScrollHintList refreshDeps={[rows.length, refreshKey]}>
      <table className={ADMIN_LIST_TABLE_CLASS}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-border/60 last:border-b-0">
              {cells.map((cell, j) => (
                <td key={j} className="px-5 py-2 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const [avgOp, setAvgOp] = useState<CompareOp>("gt");
  const [avgValue, setAvgValue] = useState("");
  const [countOp, setCountOp] = useState<CompareOp>("gt");
  const [countValue, setCountValue] = useState("");
  const [likesOp, setLikesOp] = useState<CompareOp>("gt");
  const [likesValue, setLikesValue] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredRatings = useMemo(
    () =>
      ratings.filter(
        (row) =>
          passesThreshold(row.average, avgOp, avgValue) &&
          passesThreshold(row.count, countOp, countValue),
      ),
    [ratings, avgOp, avgValue, countOp, countValue],
  );

  const filteredLikes = useMemo(
    () =>
      likes.filter((row) => passesThreshold(row.likes, likesOp, likesValue)),
    [likes, likesOp, likesValue],
  );

  const ratingsFilterKey = `${avgOp}:${avgValue}:${countOp}:${countValue}`;
  const likesFilterKey = `${likesOp}:${likesValue}`;

  const hasActiveFilters =
    view === "ratings"
      ? Boolean(avgValue.trim() || countValue.trim())
      : Boolean(likesValue.trim());

  const countLabel =
    view === "ratings"
      ? filteredRatings.length.toLocaleString()
      : filteredLikes.length.toLocaleString();

  const ratingsEmpty =
    ratings.length === 0
      ? "No ratings recorded yet."
      : "No names match these filters.";
  const likesEmpty =
    likes.length === 0
      ? "No likes recorded yet."
      : "No names match these filters.";

  const clearFilters = () => {
    if (view === "ratings") {
      setAvgOp("gt");
      setAvgValue("");
      setCountOp("gt");
      setCountValue("");
      return;
    }

    setLikesOp("gt");
    setLikesValue("");
  };

  const filterControls = (
    <CommunityFilters
      view={view}
      avgOp={avgOp}
      avgValue={avgValue}
      countOp={countOp}
      countValue={countValue}
      likesOp={likesOp}
      likesValue={likesValue}
      onAvgOpChange={setAvgOp}
      onAvgValueChange={setAvgValue}
      onCountOpChange={setCountOp}
      onCountValueChange={setCountValue}
      onLikesOpChange={setLikesOp}
      onLikesValueChange={setLikesValue}
    />
  );

  const modalFilterControls = (
    <CommunityFilters
      view={view}
      avgOp={avgOp}
      avgValue={avgValue}
      countOp={countOp}
      countValue={countValue}
      likesOp={likesOp}
      likesValue={likesValue}
      onAvgOpChange={setAvgOp}
      onAvgValueChange={setAvgValue}
      onCountOpChange={setCountOp}
      onCountValueChange={setCountValue}
      onLikesOpChange={setLikesOp}
      onLikesValueChange={setLikesValue}
      stacked
    />
  );

  return (
    <section className={ADMIN_LIST_PANEL_CLASS}>
      <div className={ADMIN_LIST_PANEL_HEADER_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu
            value={view}
            onChange={setView}
            options={COMMUNITY_OPTIONS}
            ariaLabel="Community data view"
            triggerClassName="text-lg font-bold"
          />
          <span className="text-base font-semibold tabular-nums text-subtle">
            {countLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border text-foreground transition hover:bg-hover md:hidden"
          aria-label="Open filters"
        >
          <FilterIcon />
          {hasActiveFilters ? (
            <span
              className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
                view === "likes" ? "bg-admin-like" : "bg-[var(--dash-foreground)]"
              }`}
              aria-hidden
            />
          ) : null}
        </button>
        <div className="hidden h-10 w-10 md:block" aria-hidden />
      </div>

      <div className={`${ADMIN_LIST_FILTER_ROW_CLASS} hidden md:flex`}>
        {filterControls}
      </div>

      <CommunityFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        view={view}
        filters={modalFilterControls}
        onClear={clearFilters}
      />

      {view === "ratings" ? (
        <CommunityTable
          refreshKey={`ratings:${ratingsFilterKey}`}
          empty={ratingsEmpty}
          headers={["Borg name", "Average", "Count"]}
          rows={filteredRatings.map((row) => [
            row.name,
            <span className="tabular-nums">{row.average.toFixed(1)} ★</span>,
            <span className="tabular-nums">{row.count}</span>,
          ])}
        />
      ) : (
        <CommunityTable
          refreshKey={`likes:${likesFilterKey}`}
          empty={likesEmpty}
          headers={["Borg name", "Likes"]}
          rows={filteredLikes.map((row) => [
            row.name,
            <span className="tabular-nums text-admin-like">{row.likes}</span>,
          ])}
        />
      )}
    </section>
  );
}
