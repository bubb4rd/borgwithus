import { useEffect, useState, type ReactNode } from "react";
import { useRegisterAdminListFilter } from "./AdminListPanelContext";

export type AdminListFilterOption = {
  value: string;
  label: string;
  activeClassName?: string;
};

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

function filterChipClass(active: boolean, activeClassName: string) {
  return `cursor-pointer rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
    active ? activeClassName : "bg-elevated/60 text-subtle hover:text-foreground"
  }`;
}

const SEARCH_INPUT_CLASS =
  "w-full rounded-full border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus:border-cyan/40";

type AdminListFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  options: AdminListFilterOption[];
  appliedValue: string;
  appliedSearch: string;
  onApply: (value: string, search: string) => void;
  onClear: () => void;
  searchPlaceholder: string;
};

function AdminListFilterSheet({
  open,
  onClose,
  options,
  appliedValue,
  appliedSearch,
  onApply,
  onClear,
  searchPlaceholder,
}: AdminListFilterSheetProps) {
  const defaultValue = options[0]?.value ?? "all";
  const [draftValue, setDraftValue] = useState(appliedValue);
  const [draftSearch, setDraftSearch] = useState(appliedSearch);

  useEffect(() => {
    if (!open) return;
    setDraftValue(appliedValue);
    setDraftSearch(appliedSearch);
  }, [open, appliedValue, appliedSearch]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleApply = () => {
    onApply(draftValue, draftSearch);
    onClose();
  };

  const handleClear = () => {
    setDraftValue(defaultValue);
    setDraftSearch("");
    onClear();
    onClose();
  };

  const hasDraftChanges =
    draftValue !== appliedValue || draftSearch !== appliedSearch;
  const hasActiveFilters =
    appliedValue !== defaultValue || appliedSearch.trim().length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onClose}
        aria-label="Close filters"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and filter list"
        className="admin-modal-panel relative max-h-[70dvh] w-full overflow-y-auto rounded-t-2xl border-t border-[var(--dash-border)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl md:max-w-md md:rounded-[1.35rem] md:border md:pb-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Search &amp; filter</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <label className="mb-4 block">
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleApply();
              }
            }}
            placeholder={searchPlaceholder}
            className={SEARCH_INPUT_CLASS}
            autoFocus
          />
        </label>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
          Filter
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = draftValue === option.value;
            const activeClass = option.activeClassName ?? "admin-filter-chip-active";

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraftValue(option.value)}
                className={filterChipClass(active, activeClass)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasActiveFilters && !hasDraftChanges}
            className="dash-btn-secondary cursor-pointer px-4 py-2.5 disabled:cursor-default disabled:opacity-50"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="dash-btn-primary cursor-pointer px-4 py-2.5"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

type AdminListFilterBarProps = {
  options: AdminListFilterOption[];
  value: string;
  onChange: (value: string) => void;
  countLabel: ReactNode;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
};

export default function AdminListFilterBar({
  options,
  value,
  onChange,
  countLabel,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search…",
}: AdminListFilterBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const defaultValue = options[0]?.value ?? "all";
  const activeOption =
    options.find((option) => option.value === value) ?? options[0];
  const hasSearch = searchQuery.trim().length > 0;
  const hasActiveFilter = value !== defaultValue || hasSearch;
  const activeSummary = hasSearch
    ? `"${searchQuery.trim()}"`
    : hasActiveFilter && activeOption
      ? activeOption.label
      : null;

  const handleApply = (nextValue: string, nextSearch: string) => {
    onChange(nextValue);
    onSearchChange(nextSearch);
  };

  const handleClear = () => {
    onChange(defaultValue);
    onSearchChange("");
  };

  useRegisterAdminListFilter(
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      aria-label="Search and filter list"
      aria-expanded={sheetOpen}
      className={`relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border transition ${
        hasActiveFilter
          ? "border-cyan/40 bg-cyan/10 text-cyan"
          : "border-border bg-elevated/60 text-muted hover:bg-hover hover:text-foreground"
      }`}
    >
      <FilterIcon />
      {hasActiveFilter ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan" aria-hidden />
      ) : null}
    </button>,
  );

  return (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
        <span className="truncate text-xs text-subtle">{countLabel}</span>
        {activeSummary ? (
          <span className="max-w-[55%] truncate text-xs font-medium text-foreground">
            {activeSummary}
          </span>
        ) : null}
      </div>

      <AdminListFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        options={options}
        appliedValue={value}
        appliedSearch={searchQuery}
        onApply={handleApply}
        onClear={handleClear}
        searchPlaceholder={searchPlaceholder}
      />
    </>
  );
}
