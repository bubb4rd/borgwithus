import { useEffect, useState, type FormEvent } from "react";
import SelectMenu from "./SelectMenu";
import {
  addCatalogEntry,
  PRESET_TAGS,
  type BorgKind,
} from "../lib/borgCatalog";

const KIND_OPTIONS = [
  { value: "borg" as const, label: "BORG" },
  { value: "mio" as const, label: "Mio" },
  { value: "ai" as const, label: "AI" },
];

const TAG_MODE_OPTIONS = [
  { value: "custom" as const, label: "Custom tag" },
  { value: "preset" as const, label: "Preset tag" },
];

type AdminAddBorgModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AdminAddBorgModal({ open, onClose }: AdminAddBorgModalProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<BorgKind>("borg");
  const [tagMode, setTagMode] = useState<"preset" | "custom">("custom");
  const [presetTag, setPresetTag] = useState<string>(PRESET_TAGS[0]);
  const [customTag, setCustomTag] = useState("");
  const [error, setError] = useState("");

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
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const tag = tagMode === "preset" ? presetTag : customTag;

    try {
      await addCatalogEntry({ name, kind, tag });
      closeModal();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not add entry.",
      );
    }
  };

  if (!open) return null;

  return (
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
        className="admin-modal-panel relative w-full max-w-lg rounded-[1.35rem] border border-[var(--dash-border)] p-6 shadow-2xl"
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
          <div className="grid gap-4 sm:grid-cols-2">
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
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-subtle">
                Type
              </span>
              <SelectMenu
                value={kind}
                onChange={setKind}
                options={KIND_OPTIONS}
                ariaLabel="Borg type"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-subtle">
                Tag
              </span>
              <div className="flex flex-col gap-3">
                <SelectMenu
                  value={tagMode}
                  onChange={setTagMode}
                  options={TAG_MODE_OPTIONS}
                  ariaLabel="Tag mode"
                />
                {tagMode === "preset" ? (
                  <SelectMenu
                    value={presetTag}
                    onChange={setPresetTag}
                    options={PRESET_TAGS.map((tag) => ({
                      value: tag,
                      label: tag,
                    }))}
                    ariaLabel="Preset tag"
                  />
                ) : (
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    required
                    placeholder="e.g. meme, collab, seasonal"
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30"
                  />
                )}
              </div>
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
  );
}
