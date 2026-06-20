import { useCallback, useEffect, useMemo, useState } from "react";
import ScrollHintList from "./ScrollHintList";
import {
  addCatalogEntry,
  catalogUpdateEventName,
  getFullCatalog,
} from "../lib/borgCatalog";
import {
  fetchAdminAiGenerations,
  type AdminAiGeneration,
} from "../lib/adminAiGenerations";
import { aiFeedbackUpdateEventName, type AIFeedback } from "../lib/aiFeedback";
import {
  ADMIN_LIST_FILTER_ROW_CLASS,
  ADMIN_LIST_TABLE_CLASS,
} from "../lib/adminListLayout";

function ThumbsUpIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a1 1 0 0 1-1-1v-7a4 4 0 0 1 4-4h2.5" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a1 1 0 0 1 1 1v7a4 4 0 0 1-4 4h-2.5" />
    </svg>
  );
}

function FeedbackIcon({ feedback }: { feedback: AIFeedback }) {
  const isLike = feedback === "like";

  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
        isLike
          ? "border-lime/30 bg-lime/10 text-lime"
          : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
      }`}
      aria-label={isLike ? "Liked" : "Disliked"}
      title={isLike ? "Liked" : "Disliked"}
    >
      {isLike ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
    </span>
  );
}

function ContextValue({ prompt }: { prompt: string }) {
  const value = prompt.trim();
  if (!value) {
    return <span className="text-subtle">N/A</span>;
  }

  return <span className="break-words text-foreground">{value}</span>;
}

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

function formatWhenFull(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MoreIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type DetailModalProps = {
  row: AdminAiGeneration;
  inCatalog: boolean;
  adding: boolean;
  onClose: () => void;
  onAdd: () => void;
};

function AiGenerationDetailModal({
  row,
  inCatalog,
  adding,
  onClose,
  onAdd,
}: DetailModalProps) {
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
        aria-labelledby="ai-generation-detail-title"
        className="relative w-full max-w-md rounded-[1.35rem] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="ai-generation-detail-title"
              className="text-lg font-bold text-[var(--dash-foreground)]"
            >
              AI generation
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
              Rating
            </dt>
            <dd className="mt-1">
              <FeedbackIcon feedback={row.feedback} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              User
            </dt>
            <dd className="mt-1 text-foreground">{row.userName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Context
            </dt>
            <dd className="mt-1">
              <ContextValue prompt={row.prompt} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Rated
            </dt>
            <dd className="mt-1 text-foreground">{formatWhenFull(row.updatedAt)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={inCatalog || adding}
            onClick={onAdd}
            className="dash-btn-primary inline-flex cursor-pointer items-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inCatalog ? (
              <>
                <CheckIcon />
                In catalog
              </>
            ) : adding ? (
              "Adding…"
            ) : (
              <>
                <span className="text-lg leading-none">+</span>
                Add to BORGs
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAiGenerationCenter() {
  const [rows, setRows] = useState<AdminAiGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | AIFeedback>("all");
  const [catalogNames, setCatalogNames] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<AdminAiGeneration | null>(null);

  const refreshCatalog = useCallback(() => {
    setCatalogNames(
      new Set(getFullCatalog().map((entry) => entry.name.trim().toLowerCase())),
    );
  }, []);

  const loadGenerations = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminAiGenerations();
    setRows(result.rows);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshCatalog();
    void loadGenerations();

    const onCatalogUpdate = () => refreshCatalog();
    const onFeedbackUpdate = () => void loadGenerations();

    window.addEventListener(catalogUpdateEventName(), onCatalogUpdate);
    window.addEventListener(aiFeedbackUpdateEventName(), onFeedbackUpdate);
    return () => {
      window.removeEventListener(catalogUpdateEventName(), onCatalogUpdate);
      window.removeEventListener(aiFeedbackUpdateEventName(), onFeedbackUpdate);
    };
  }, [loadGenerations, refreshCatalog]);

  const visible = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => row.feedback === filter);
  }, [filter, rows]);

  const handleQuickAdd = async (row: AdminAiGeneration) => {
    const normalized = row.name.trim().toLowerCase();
    if (catalogNames.has(normalized) || addedIds.has(row.id)) return;

    setAddingId(row.id);
    try {
      await addCatalogEntry({ name: row.name.trim(), kind: "ai", tag: "ai" });
      setAddedIds((current) => new Set(current).add(row.id));
      refreshCatalog();
    } catch {
      // addCatalogEntry throws on duplicate; catalog set will refresh on next update.
    } finally {
      setAddingId(null);
    }
  };

  const isInCatalog = (row: AdminAiGeneration) =>
    catalogNames.has(row.name.trim().toLowerCase()) || addedIds.has(row.id);

  return (
    <>
      <div className={ADMIN_LIST_FILTER_ROW_CLASS}>
        {(["all", "like", "dislike"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              filter === value
                ? "admin-filter-chip-active"
                : "bg-elevated/60 text-subtle hover:text-foreground"
            }`}
          >
            {value === "all" ? "All" : value === "like" ? "Liked" : "Disliked"}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-subtle">
          {loading ? "Loading…" : `${visible.length} shown`}
        </span>
      </div>

      {error ? (
        <p className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : loading ? (
        <p className="px-5 py-6 text-sm text-subtle">Loading AI generations…</p>
      ) : visible.length === 0 ? (
        <p className="px-5 py-6 text-sm text-subtle">
          No AI generations yet. Users can rate names in the BORG AI generator.
        </p>
      ) : (
        <ScrollHintList
          refreshDeps={[visible.length, filter, rows.length]}
        >
          <table className={`${ADMIN_LIST_TABLE_CLASS} min-w-[20rem]`}>
            <thead>
              <tr>
                <th>Name</th>
                <th>
                  <span className="sr-only">Rating</span>
                </th>
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
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td
                      className={`max-w-[11rem] px-5 py-2.5 font-medium ${
                        inCatalog ? "admin-ai-added-subtle" : "text-foreground"
                      }`}
                    >
                      <span className="line-clamp-1">{row.name}</span>
                    </td>
                    <td className={`px-5 py-2.5 ${inCatalog ? "admin-ai-added-subtle" : ""}`}>
                      <FeedbackIcon feedback={row.feedback} />
                    </td>
                    <td
                      className={`whitespace-nowrap px-5 py-2.5 ${
                        inCatalog ? "admin-ai-added-subtle" : "text-subtle"
                      }`}
                    >
                      {formatWhenShort(row.updatedAt)}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition ${
                            inCatalog
                              ? "admin-ai-added-subtle hover:bg-elevated/80"
                              : "text-subtle hover:bg-elevated/80 hover:text-foreground"
                          }`}
                          aria-label={`More details for ${row.name}`}
                        >
                          <MoreIcon />
                        </button>
                        <button
                          type="button"
                          disabled={inCatalog || adding}
                          onClick={() => void handleQuickAdd(row)}
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
                          {inCatalog ? (
                            <CheckIcon />
                          ) : adding ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                          ) : (
                            <span className="text-lg font-bold leading-none">+</span>
                          )}
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
        <AiGenerationDetailModal
          row={detailRow}
          inCatalog={isInCatalog(detailRow)}
          adding={addingId === detailRow.id}
          onClose={() => setDetailRow(null)}
          onAdd={() => void handleQuickAdd(detailRow)}
        />
      ) : null}
    </>
  );
}
