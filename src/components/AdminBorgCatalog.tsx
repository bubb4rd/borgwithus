import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScrollHintList from "./ScrollHintList";
import {
  BORG_KIND_LABELS,
  catalogUpdateEventName,
  formatTagLabel,
  getCatalogCustomTags,
  getEntryCatalogTag,
  getFullCatalog,
  removeAdminCatalogEntry,
  tagBadgeClass,
  type BorgCatalogEntry,
  type BorgKind,
} from "../lib/borgCatalog";
import {
  ADMIN_LIST_FILTER_ROW_CLASS,
  ADMIN_LIST_TABLE_CLASS,
} from "../lib/adminListLayout";

function KindBadge({ kind }: { kind: BorgKind }) {
  return (
    <span className="admin-kind-badge inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
      {BORG_KIND_LABELS[kind]}
    </span>
  );
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

function formatWhenShort(iso: string) {
  if (!iso) return "—";
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
  if (!iso) return "—";
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

function canRemoveEntry(entry: BorgCatalogEntry) {
  return entry.source === "admin";
}

type BorgCatalogFilter =
  | { mode: "all" }
  | { mode: "kind"; value: BorgKind }
  | { mode: "tag"; value: string };

function filterChipClass(active: boolean, activeClass: string) {
  return `cursor-pointer rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
    active ? activeClass : "bg-elevated/60 text-subtle hover:text-foreground"
  }`;
}

function CatalogDetailModal({
  entry,
  removing,
  onClose,
  onRemove,
}: {
  entry: BorgCatalogEntry;
  removing: boolean;
  onClose: () => void;
  onRemove: () => void;
}) {
  const removable = canRemoveEntry(entry);
  const catalogTag = getEntryCatalogTag(entry);

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
              Catalog entry
            </h3>
            <p className="mt-1 break-words text-base font-semibold text-foreground">
              {entry.name}
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
              Type
            </dt>
            <dd className="mt-1">
              <KindBadge kind={entry.kind} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Tag
            </dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tagBadgeClass(catalogTag)}`}
              >
                {formatTagLabel(catalogTag)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Source
            </dt>
            <dd className="mt-1 capitalize text-foreground">{entry.source}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Added
            </dt>
            <dd className="mt-1 text-foreground">{formatWhenLong(entry.addedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Catalog ID
            </dt>
            <dd className="mt-1 break-all font-mono text-xs text-subtle">{entry.id}</dd>
          </div>
        </dl>

        {removable ? (
          <button
            type="button"
            disabled={removing}
            onClick={onRemove}
            className="mt-5 w-full cursor-pointer rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-500/15 disabled:cursor-default disabled:opacity-60 dark:text-red-400"
          >
            {removing ? "Removing…" : "Remove from catalog"}
          </button>
        ) : (
          <p className="mt-5 text-xs text-subtle">
            Seed names are bundled with the app and cannot be removed from the catalog.
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogActionsMenu({
  entry,
  open,
  onToggle,
  onClose,
  onOpenDetails,
  onRemove,
  removable,
}: {
  entry: BorgCatalogEntry;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenDetails: () => void;
  onRemove: () => void;
  removable: boolean;
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
        aria-label={`More actions for ${entry.name}`}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-subtle transition hover:bg-elevated/80 hover:text-foreground"
      >
        <MoreIcon />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
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
          {removable ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onRemove();
              }}
              className="flex w-full cursor-pointer px-3 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
            >
              Remove from catalog
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminBorgCatalog() {
  const [entries, setEntries] = useState<BorgCatalogEntry[]>([]);
  const [filter, setFilter] = useState<BorgCatalogFilter>({ mode: "all" });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<BorgCatalogEntry | null>(null);
  const [menuEntryId, setMenuEntryId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEntries(getFullCatalog());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(catalogUpdateEventName(), refresh);
    return () => window.removeEventListener(catalogUpdateEventName(), refresh);
  }, [refresh]);

  const customTags = useMemo(() => getCatalogCustomTags(entries), [entries]);

  const visible = useMemo(() => {
    if (filter.mode === "all") return entries;
    if (filter.mode === "kind") {
      return entries.filter((entry) => entry.kind === filter.value);
    }
    return entries.filter((entry) => getEntryCatalogTag(entry) === filter.value);
  }, [entries, filter]);

  const handleRemove = async (entry: BorgCatalogEntry) => {
    if (!canRemoveEntry(entry) || removingId === entry.id) return;

    setRemovingId(entry.id);
    try {
      await removeAdminCatalogEntry(entry.id);
      if (detailEntry?.id === entry.id) setDetailEntry(null);
      if (menuEntryId === entry.id) setMenuEntryId(null);
      refresh();
    } catch {
      // removeAdminCatalogEntry throws on remote errors; list refreshes on next update.
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <div className={ADMIN_LIST_FILTER_ROW_CLASS}>
        <button
          type="button"
          onClick={() => setFilter({ mode: "all" })}
          className={filterChipClass(filter.mode === "all", "admin-filter-chip-active")}
        >
          All
        </button>
        {(["borg", "mio", "ai"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter({ mode: "kind", value })}
            className={filterChipClass(
              filter.mode === "kind" && filter.value === value,
              "admin-filter-chip-active",
            )}
          >
            {BORG_KIND_LABELS[value]}
          </button>
        ))}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setFilter({ mode: "tag", value: tag })}
            className={filterChipClass(
              filter.mode === "tag" && filter.value === tag,
              "admin-filter-chip-active",
            )}
          >
            {formatTagLabel(tag)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-6 text-sm text-subtle">No names in this filter yet.</p>
      ) : (
        <ScrollHintList refreshDeps={[visible.length, entries.length, filter]}>
          <table className={`${ADMIN_LIST_TABLE_CLASS} min-w-[24rem]`}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Tag</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => {
                const catalogTag = getEntryCatalogTag(entry);
                const removable = canRemoveEntry(entry);
                const removing = removingId === entry.id;

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="max-w-[11rem] px-5 py-2.5 font-medium text-foreground">
                      <span className="line-clamp-1">{entry.name}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      <KindBadge kind={entry.kind} />
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tagBadgeClass(catalogTag)}`}
                      >
                        {formatTagLabel(catalogTag)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <CatalogActionsMenu
                          entry={entry}
                          open={menuEntryId === entry.id}
                          onToggle={() =>
                            setMenuEntryId((current) =>
                              current === entry.id ? null : entry.id,
                            )
                          }
                          onClose={() => setMenuEntryId(null)}
                          onOpenDetails={() => setDetailEntry(entry)}
                          onRemove={() => void handleRemove(entry)}
                          removable={removable}
                        />
                        <button
                          type="button"
                          disabled={!removable || removing}
                          onClick={() => void handleRemove(entry)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-lg leading-none transition ${
                            removable
                              ? "cursor-pointer border-border bg-elevated/60 text-muted hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:cursor-default"
                              : "cursor-default border-transparent text-transparent"
                          }`}
                          aria-label={
                            removable
                              ? `Remove ${entry.name} from catalog`
                              : `${entry.name} cannot be removed`
                          }
                          aria-hidden={!removable}
                          tabIndex={removable ? 0 : -1}
                        >
                          {removing ? "…" : "×"}
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

      {detailEntry ? (
        <CatalogDetailModal
          entry={detailEntry}
          removing={removingId === detailEntry.id}
          onClose={() => setDetailEntry(null)}
          onRemove={() => void handleRemove(detailEntry)}
        />
      ) : null}
    </>
  );
}
