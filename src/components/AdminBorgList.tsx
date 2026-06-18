import { useEffect, useState, type FormEvent } from "react";
import ScrollHintList from "./ScrollHintList";
import {
  addCatalogEntry,
  BORG_KIND_LABELS,
  catalogUpdateEventName,
  getFullCatalog,
  PRESET_TAGS,
  tagBadgeClass,
  type BorgCatalogEntry,
  type BorgKind,
} from "../lib/borgCatalog";

const LIST_HEIGHT = 302;

function KindBadge({ kind }: { kind: BorgKind }) {
  const styles: Record<BorgKind, string> = {
    borg: "bg-cyan/10 text-cyan border-cyan/20",
    mio: "bg-lime/10 text-lime border-lime/20",
    ai: "bg-magenta/10 text-magenta border-magenta/20",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[kind]}`}
    >
      {BORG_KIND_LABELS[kind]}
    </span>
  );
}

export default function AdminBorgList({ totalCount }: { totalCount: number }) {
  const [entries, setEntries] = useState<BorgCatalogEntry[]>([]);
  const [showForm, setShowForm] = useState(false);  const [name, setName] = useState("");
  const [kind, setKind] = useState<BorgKind>("borg");
  const [tagMode, setTagMode] = useState<"preset" | "custom">("custom");
  const [presetTag, setPresetTag] = useState<string>(PRESET_TAGS[0]);
  const [customTag, setCustomTag] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | BorgKind>("all");

  useEffect(() => {
    const refresh = () => setEntries(getFullCatalog());
    refresh();
    window.addEventListener(catalogUpdateEventName(), refresh);
    return () => window.removeEventListener(catalogUpdateEventName(), refresh);
  }, []);

  const visible =
    filter === "all" ? entries : entries.filter((entry) => entry.kind === filter);

  const resetForm = () => {
    setName("");
    setKind("borg");
    setTagMode("custom");
    setPresetTag(PRESET_TAGS[0]);
    setCustomTag("");
    setError("");
  };

  const closeModal = () => {
    resetForm();
    setShowForm(false);
  };

  useEffect(() => {
    if (!showForm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showForm]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const tag = tagMode === "preset" ? presetTag : customTag;

    try {
      addCatalogEntry({ name, kind, tag });
      closeModal();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not add entry."
      );
    }
  };

  return (
    <section className="dashboard-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            BORG list
            <span className="ml-2 text-base font-semibold tabular-nums text-subtle">
              {totalCount.toLocaleString()}
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-cyan to-sky-400 text-xl font-bold text-on-accent shadow-md transition hover:opacity-90"
          aria-label="Add name"
          title="Add name"
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-5 py-2">
        {(["all", "borg", "mio", "ai"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              filter === value
                ? "bg-cyan/15 text-cyan"
                : "bg-elevated/60 text-subtle hover:text-foreground"
            }`}
          >
            {value === "all" ? "All" : BORG_KIND_LABELS[value]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/50"
            onClick={closeModal}
            aria-label="Close add dialog"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-borg-title"
            className="relative w-full max-w-lg rounded-[1.35rem] border border-[var(--dash-border)] bg-[var(--dash-surface)] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3
                  id="add-borg-title"
                  className="text-lg font-bold text-[var(--dash-foreground)]"
                >
                  Add name
                </h3>
                <p className="mt-1 text-sm text-[var(--dash-muted)]">
                  Add a BORG, Mio, or AI name to the catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--dash-border)] text-[var(--dash-muted)] transition hover:bg-elevated/60 hover:text-[var(--dash-foreground)]"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle">
                    Name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    placeholder="e.g. Borgingham Palace"
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan/40"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle">
                    Type
                  </span>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as BorgKind)}
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan/40"
                  >
                    <option value="borg">BORG</option>
                    <option value="mio">Mio</option>
                    <option value="ai">AI</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle">
                    Tag
                  </span>
                  <select
                    value={tagMode}
                    onChange={(e) => setTagMode(e.target.value as "preset" | "custom")}
                    className="mb-2 w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan/40"
                  >
                    <option value="custom">Custom tag</option>
                    <option value="preset">Preset tag</option>
                  </select>
                  {tagMode === "preset" ? (
                    <select
                      value={presetTag}
                      onChange={(e) => setPresetTag(e.target.value)}
                      className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan/40"
                    >
                      {PRESET_TAGS.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      required
                      placeholder="e.g. meme, collab, seasonal"
                      className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan/40"
                    />
                  )}
                </label>
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="dash-btn-secondary cursor-pointer px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="dash-btn-primary cursor-pointer px-4">
                  Add to list
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="px-5 py-6 text-sm text-subtle">No names in this filter yet.</p>
      ) : (
        <ScrollHintList
          height={LIST_HEIGHT}
          refreshDeps={[visible.length, filter]}
        >
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border bg-elevated/60">
                <th className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-subtle">
                  Name
                </th>
                <th className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-subtle">
                  Type
                </th>
                <th className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-subtle">
                  Tag
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-5 py-2 font-medium text-foreground">{entry.name}</td>
                  <td className="px-5 py-2">
                    <KindBadge kind={entry.kind} />
                  </td>
                  <td className="px-5 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tagBadgeClass(entry.tag)}`}
                    >
                      {entry.tag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollHintList>
      )}
    </section>
  );
}
