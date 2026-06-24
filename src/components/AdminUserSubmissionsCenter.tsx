import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScrollHintList from "./ScrollHintList";
import {
  addCatalogEntry,
  catalogUpdateEventName,
  getFullCatalog,
} from "../lib/borgCatalog";
import {
  ADMIN_LIST_FILTER_ROW_CLASS,
  ADMIN_LIST_TABLE_CLASS,
} from "../lib/adminListLayout";
import {
  getUserSubmissions,
  removeUserSubmission,
  updateUserSubmissionStatus,
  userSubmissionsUpdateEventName,
  type UserSubmission,
  type UserSubmissionStatus,
} from "../lib/userSubmissions";

const STATUS_FILTERS = ["all", "pending", "approved", "dismissed"] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABELS: Record<UserSubmissionStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  dismissed: "Dismissed",
};

function formatWhenShort(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWhenLong(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUserId(userId: string | null) {
  if (!userId) return "—";
  return userId;
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function StatusBadge({ status }: { status: UserSubmissionStatus }) {
  const styles: Record<UserSubmissionStatus, string> = {
    pending: "border-border bg-elevated/60 text-subtle",
    approved: "border-border bg-badge text-muted",
    dismissed: "border-border bg-badge text-muted opacity-70",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function filterChipClass(active: boolean) {
  return `cursor-pointer rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
    active ? "admin-filter-chip-active" : "bg-elevated/60 text-subtle hover:text-foreground"
  }`;
}

function SubmissionDetailModal({
  row,
  onClose,
}: {
  row: UserSubmission;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onClose}
        aria-label="Close details"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="admin-modal-panel relative w-full max-w-md rounded-[1.35rem] border border-[var(--dash-border)] p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[var(--dash-foreground)]">
              Submission details
            </h3>
            <p className="mt-1 break-words text-base font-semibold text-foreground">
              {row.name}
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

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              User ID
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-foreground sm:text-sm">
              {formatUserId(row.userId)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Display name
            </dt>
            <dd className="mt-1 text-foreground">{row.userName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Note
            </dt>
            <dd className="mt-1 break-words text-foreground">
              {row.note || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Submitted
            </dt>
            <dd className="mt-1 text-foreground">{formatWhenLong(row.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Status
            </dt>
            <dd className="mt-1">
              <StatusBadge status={row.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Submission ID
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-subtle">{row.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function SubmissionActionsMenu({
  row,
  open,
  onToggle,
  onClose,
  onOpenDetails,
  onDelete,
}: {
  row: UserSubmission;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenDetails: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${row.name}`}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-subtle transition hover:bg-elevated/80 hover:text-foreground"
      >
        <MoreIcon />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onOpenDetails();
            }}
            className="flex w-full cursor-pointer px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-hover"
          >
            Full details
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="flex w-full cursor-pointer px-3 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminUserSubmissionsCenter() {
  const [rows, setRows] = useState<UserSubmission[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [catalogNames, setCatalogNames] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<UserSubmission | null>(null);
  const [menuRowId, setMenuRowId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRows(getUserSubmissions());
    setCatalogNames(
      new Set(getFullCatalog().map((entry) => entry.name.trim().toLowerCase())),
    );
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener(userSubmissionsUpdateEventName(), onUpdate);
    window.addEventListener(catalogUpdateEventName(), onUpdate);
    return () => {
      window.removeEventListener(userSubmissionsUpdateEventName(), onUpdate);
      window.removeEventListener(catalogUpdateEventName(), onUpdate);
    };
  }, [refresh]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.status === filter);
  }, [filter, rows]);

  const handleApprove = async (row: UserSubmission) => {
    const normalized = row.name.trim().toLowerCase();
    if (catalogNames.has(normalized) || row.status === "approved") return;

    setAddingId(row.id);
    try {
      await addCatalogEntry({ name: row.name.trim(), kind: "borg", tag: "user" });
      updateUserSubmissionStatus(row.id, "approved");
      refresh();
    } catch {
      // addCatalogEntry throws on duplicate; refresh on next update.
    } finally {
      setAddingId(null);
    }
  };

  const handleDelete = (row: UserSubmission) => {
    removeUserSubmission(row.id);
    if (detailRow?.id === row.id) setDetailRow(null);
    if (menuRowId === row.id) setMenuRowId(null);
    refresh();
  };

  const isInCatalog = (row: UserSubmission) =>
    catalogNames.has(row.name.trim().toLowerCase()) || row.status === "approved";

  return (
    <>
      <div className={ADMIN_LIST_FILTER_ROW_CLASS}>
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={filterChipClass(filter === value)}
          >
            {value === "all" ? "All" : STATUS_LABELS[value]}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-subtle">
          {visible.length} shown
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-6 text-sm text-subtle">
          {rows.length === 0
            ? "No user submissions yet."
            : "No submissions match this filter."}
        </p>
      ) : (
        <ScrollHintList refreshDeps={[visible.length, filter, rows.length]}>
          <table className={`${ADMIN_LIST_TABLE_CLASS} min-w-[24rem]`}>
            <thead>
              <tr>
                <th>Name</th>
                <th>User ID</th>
                <th>Status</th>
                <th>When</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const inCatalog = isInCatalog(row);
                const adding = addingId === row.id;
                const dismissed = row.status === "dismissed";

                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td
                      className={`max-w-[11rem] px-5 py-2.5 font-medium ${
                        dismissed ? "admin-ai-added-subtle" : "text-foreground"
                      }`}
                    >
                      <span className="line-clamp-1">{row.name}</span>
                    </td>
                    <td
                      className={`max-w-[10rem] px-5 py-2.5 ${
                        dismissed ? "admin-ai-added-subtle text-subtle" : "text-subtle"
                      }`}
                    >
                      <span className="line-clamp-1 break-all font-mono text-xs">
                        {formatUserId(row.userId)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-2.5 ${
                        dismissed ? "admin-ai-added-subtle" : "text-subtle"
                      }`}
                    >
                      {formatWhenShort(row.submittedAt)}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <SubmissionActionsMenu
                          row={row}
                          open={menuRowId === row.id}
                          onToggle={() =>
                            setMenuRowId((current) =>
                              current === row.id ? null : row.id,
                            )
                          }
                          onClose={() => setMenuRowId(null)}
                          onOpenDetails={() => setDetailRow(row)}
                          onDelete={() => handleDelete(row)}
                        />
                        <button
                          type="button"
                          disabled={inCatalog || adding || dismissed}
                          onClick={() => void handleApprove(row)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-100 ${
                            inCatalog
                              ? "admin-ai-added-btn"
                              : "cursor-pointer border-border bg-elevated/60 text-foreground hover:bg-hover disabled:cursor-default"
                          }`}
                          aria-label={
                            inCatalog
                              ? `${row.name} is in catalog`
                              : `Add ${row.name} to BORGs`
                          }
                        >
                          {inCatalog ? "✓" : adding ? "…" : "+"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollHintList>
      )}

      {detailRow ? (
        <SubmissionDetailModal row={detailRow} onClose={() => setDetailRow(null)} />
      ) : null}
    </>
  );
}
