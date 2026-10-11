import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBorgs } from "../../context/BorgsContext";
import { timeAgo } from "../../lib/timeAgo";
import * as api from "./borgsApi";
import { fmt, fmtDateTime } from "./metrics";
import { Empty, Panel } from "./Panel";
import "./Studio.css";
import "./Borgs.css";

const SOURCES = {
  classic: { label: "Classic", title: "One of the site's own names, or added here" },
  member: { label: "Member", title: "Sent in by a member and approved" },
  ai: { label: "AI", title: "A BORG AI name rated good or fixed in the AI Borg Studio" },
};
const SOURCE_ORDER = Object.keys(SOURCES);
/** Offered in every category field next to the categories already in use. */
const SUGGESTED_CATEGORIES = [
  "Celebrities",
  "Movies & TV",
  "Music",
  "Sports",
  "History",
  "Politics",
  "Food & Drink",
  "Places",
  "Brands",
  "Science",
  "Wordplay",
];
const UNSORTED = "\u0000unsorted";
const CATEGORY_LIST_ID = "borgs-categories";
const MAX_NAME = 80;
const MAX_ORIGINAL = 80;
const MAX_CATEGORY = 40;
const COLUMNS = 10;
/** Columns that sort high-to-low (or newest first) on the first click. */
const DESCENDING_FIRST = new Set(["likes", "rolls", "added"]);

const byText = (a, b) => {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
};

const COMPARE = {
  name: (a, b) => byText(a.name, b.name),
  original: (a, b) => byText(a.original, b.original),
  source: (a, b) => SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source),
  category: (a, b) => byText(a.category, b.category),
  featured: (a, b) => Number(a.featured) - Number(b.featured),
  likes: (a, b) => a.likes - b.likes,
  rolls: (a, b) => a.rolls - b.rolls,
  added: (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
};

function sortRows(rows, { key, dir }) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * (COMPARE[key](a, b) || a.id - b.id));
}

function matches(row, needle) {
  return [row.name, row.original, row.category, row.author].some((value) => value?.toLowerCase().includes(needle));
}

function Seg({ label, value, onChange, options }) {
  return (
    <div className="dash-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={option.key === value ? "is-active" : ""}
          aria-pressed={option.key === value}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SourceTag({ source }) {
  const meta = SOURCES[source];
  return (
    <span className={`borgs-source is-${source}`} title={meta?.title}>
      {meta?.label ?? source}
    </span>
  );
}

function SortHeader({ id, label, sort, onSort, className = "" }) {
  const active = sort.key === id;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" className={`borgs-sort${active ? " is-active" : ""}`} onClick={() => onSort(id)}>
        {label}
        <span aria-hidden="true">{active ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
      </button>
    </th>
  );
}

function SelectAll({ rows, selected, onChange }) {
  const ref = useRef(null);
  const ticked = rows.filter((row) => selected.has(row.id)).length;
  const all = rows.length > 0 && ticked === rows.length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = ticked > 0 && !all;
  }, [ticked, all]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="studio-check"
      aria-label={all ? "Untick every borg shown" : "Tick every borg shown"}
      checked={all}
      disabled={rows.length === 0}
      onChange={() => onChange(rows.map((row) => row.id), !all)}
    />
  );
}

/** The add form above the table. New names go in as classics. */
function AddBorg({ onAdd, onClose }) {
  const [draft, setDraft] = useState({ name: "", original: "", category: "", featured: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.name.trim()) {
      setError("Give it a name.");
      return;
    }
    setSaving(true);
    try {
      await onAdd(draft);
      setDraft({ name: "", original: "", category: draft.category, featured: false });
      nameRef.current?.focus();
    } catch (failure) {
      setError(failure.message);
    }
    setSaving(false);
  };

  return (
    <Panel
      className="borgs-add"
      title="Add a borg"
      sub="Goes on the board as a classic: the generator rolls it right away"
      aside={
        <button type="button" className="studio-plus is-close" aria-label="Close" onClick={onClose} disabled={saving} />
      }
    >
      <form className="borgs-add-form" onSubmit={submit} onKeyDown={(event) => event.key === "Escape" && onClose()}>
        <label className="studio-field">
          <span>Name</span>
          <input
            ref={nameRef}
            className="studio-input"
            value={draft.name}
            maxLength={MAX_NAME}
            placeholder="Kendrick Borgmar"
            onChange={set("name")}
          />
        </label>
        <label className="studio-field">
          <span>Original</span>
          <input
            className="studio-input"
            value={draft.original}
            maxLength={MAX_ORIGINAL}
            placeholder="Kendrick Lamar"
            onChange={set("original")}
          />
        </label>
        <label className="studio-field">
          <span>Category</span>
          <input
            className="studio-input"
            value={draft.category}
            maxLength={MAX_CATEGORY}
            list={CATEGORY_LIST_ID}
            placeholder="Music"
            onChange={set("category")}
          />
        </label>
        <label className="studio-field is-inline borgs-add-featured">
          <input type="checkbox" className="studio-check" checked={draft.featured} onChange={set("featured")} />
          <span>Featured</span>
        </label>
        <button type="submit" className="btn btn-acid btn-sm" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </button>
        {error && (
          <p className="studio-row-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}

function Stats({ row }) {
  return (
    <>
      <td className="borgs-num" title={row.dislikes ? `${fmt(row.dislikes)} 👎 on BORG AI` : undefined}>
        {fmt(row.likes)}
        {row.dislikes > 0 && <span className="borgs-dislikes"> / −{fmt(row.dislikes)}</span>}
      </td>
      <td className="borgs-num">{fmt(row.rolls)}</td>
      <td className="borgs-num">
        <time dateTime={row.created_at} title={fmtDateTime(row.created_at)}>
          {timeAgo(row.created_at)}
        </time>
      </td>
    </>
  );
}

function NameCell({ row }) {
  return (
    <td className="borgs-name-cell">
      <span className="borgs-name">{row.name}</span>
      {row.author && <span className="borgs-meta">by {row.author}</span>}
    </td>
  );
}

/** A row being edited in place: Enter saves, Esc cancels. */
function EditRow({ row, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    name: row.name,
    original: row.original ?? "",
    category: row.category ?? "",
    featured: row.featured,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const save = async () => {
    if (saving) return;
    if (!draft.name.trim()) {
      setError("Names can't be blank.");
      return;
    }
    setSaving(true);
    try {
      await onSave(row, draft);
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
      // Back to the name, so Enter retries and Esc cancels.
      nameRef.current?.focus();
    }
  };

  const keys = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <>
      <tr className="borgs-row is-editing" onKeyDown={keys}>
        <td className="borgs-check-cell" />
        <td>
          <input
            ref={nameRef}
            className="studio-input"
            aria-label="Name"
            value={draft.name}
            maxLength={MAX_NAME}
            readOnly={saving}
            onChange={set("name")}
          />
          {row.source === "member" && <span className="borgs-meta">Renames their submission on the wall too</span>}
        </td>
        <td>
          <input
            className="studio-input"
            aria-label="Original"
            value={draft.original}
            maxLength={MAX_ORIGINAL}
            placeholder="Original"
            readOnly={saving}
            onChange={set("original")}
          />
        </td>
        <td>
          <SourceTag source={row.source} />
        </td>
        <td>
          <input
            className="studio-input"
            aria-label="Category"
            value={draft.category}
            maxLength={MAX_CATEGORY}
            list={CATEGORY_LIST_ID}
            placeholder="Category"
            readOnly={saving}
            onChange={set("category")}
          />
        </td>
        <td className="borgs-center">
          <input
            type="checkbox"
            className="studio-check"
            aria-label="Featured"
            checked={draft.featured}
            disabled={saving}
            onChange={set("featured")}
          />
        </td>
        <Stats row={row} />
        <td className="borgs-actions">
          <div className="borgs-buttons">
            <button type="button" className="btn btn-acid btn-sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr className="borgs-row-note">
          <td colSpan={COLUMNS}>
            <p className="studio-row-error" role="alert">
              {error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function ViewRow({ row, ticked, busy, onTick, onEdit, onFeature, onDelete }) {
  return (
    <tr className={`borgs-row${ticked ? " is-ticked" : ""}`}>
      <td className="borgs-check-cell">
        <input
          type="checkbox"
          className="studio-check"
          aria-label={`Tick ${row.name}`}
          checked={ticked}
          onChange={() => onTick([row.id], !ticked)}
        />
      </td>
      <NameCell row={row} />
      <td className={row.original ? "" : "borgs-blank"}>{row.original ?? "—"}</td>
      <td>
        <SourceTag source={row.source} />
      </td>
      <td>
        {row.category ? <span className="borgs-category">{row.category}</span> : <span className="borgs-blank">—</span>}
      </td>
      <td className="borgs-center">
        <button
          type="button"
          className={`borgs-star${row.featured ? " is-on" : ""}`}
          aria-pressed={row.featured}
          aria-label={row.featured ? `Unfeature ${row.name}` : `Feature ${row.name}`}
          title={row.featured ? "Featured in the home page marquee" : "Feature in the home page marquee"}
          disabled={busy}
          onClick={() => onFeature(row)}
        >
          {row.featured ? "★" : "☆"}
        </button>
      </td>
      <Stats row={row} />
      <td className="borgs-actions">
        <div className="borgs-buttons">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(row)} disabled={busy}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm borgs-delete"
            onClick={() => onDelete([row])}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function BulkBar({ rows, hidden, busy, onCategory, onFeature, onDelete, onClear }) {
  const [category, setCategory] = useState("");
  const count = rows.length;
  return (
    <div className="borgs-bulk" role="region" aria-label="Selected borgs">
      <p className="borgs-bulk-count">
        <b>{fmt(count)}</b> selected
        {hidden > 0 && <span> · {fmt(hidden)} hidden by filters</span>}
      </p>
      <form
        className="borgs-bulk-category"
        onSubmit={(event) => {
          event.preventDefault();
          onCategory(rows, category);
        }}
      >
        <input
          className="studio-input"
          aria-label="Category for the selected borgs"
          value={category}
          maxLength={MAX_CATEGORY}
          list={CATEGORY_LIST_ID}
          placeholder="Category"
          disabled={busy}
          onChange={(event) => setCategory(event.target.value)}
        />
        <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
          {category.trim() ? "Set category" : "Clear category"}
        </button>
      </form>
      <div className="borgs-bulk-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFeature(rows, true)} disabled={busy}>
          Feature
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFeature(rows, false)} disabled={busy}>
          Unfeature
        </button>
        <button type="button" className="btn btn-ghost btn-sm borgs-delete" onClick={() => onDelete(rows)} disabled={busy}>
          Delete
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear} disabled={busy}>
          Untick all
        </button>
      </div>
    </div>
  );
}

const plural = (n, one, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;

export default function Borgs() {
  const { reload: reloadBoard } = useBorgs();
  const [state, setState] = useState({ status: "loading", rows: null, error: null, loadedAt: null });
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [category, setCategory] = useState("all");
  const [featured, setFeatured] = useState("all");
  const [sort, setSort] = useState({ key: "added", dir: "desc" });
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((current) => ({ ...current, status: "loading" }));
    let rows;
    let error;
    try {
      rows = await api.listBorgs();
    } catch (failure) {
      error = failure;
    }
    // A newer load (refresh, change, unmount) supersedes this one.
    if (id !== latest.current) return;
    if (error) {
      setState((current) => ({ ...current, status: "error", error: error.message }));
      return;
    }
    setState({ status: "ready", rows, error: null, loadedAt: new Date() });
    const ids = new Set(rows.map((row) => row.id));
    setSelected((current) => new Set([...current].filter((rowId) => ids.has(rowId))));
    setEditing((current) => (current != null && ids.has(current) ? current : null));
  }, []);

  useEffect(() => {
    load();
    return () => {
      latest.current += 1;
    };
  }, [load]);

  // The site reads the same table, so the generator and marquee pick changes up too.
  const changed = useCallback(
    async (text) => {
      setNotice({ tone: "ok", text });
      reloadBoard();
      await load();
    },
    [load, reloadBoard]
  );

  const { status, rows, error, loadedAt } = state;
  const all = useMemo(() => rows ?? [], [rows]);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const row of all) if (row.category) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => byText(a, b));
  }, [all]);

  const suggestions = useMemo(() => {
    const inUse = new Set(categories.map(([name]) => name.toLowerCase()));
    return [...categories.map(([name]) => name), ...SUGGESTED_CATEGORIES.filter((name) => !inUse.has(name.toLowerCase()))];
  }, [categories]);

  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => {
    const kept = all.filter(
      (row) =>
        (source === "all" || row.source === source) &&
        (category === "all" || (category === UNSORTED ? !row.category : row.category === category)) &&
        (featured === "all" || row.featured === (featured === "yes")) &&
        (!needle || matches(row, needle))
    );
    return sortRows(kept, sort);
  }, [all, source, category, featured, needle, sort]);

  const selectedRows = all.filter((row) => selected.has(row.id));
  const hiddenSelected = selectedRows.length - shown.filter((row) => selected.has(row.id)).length;
  const filtering = needle || source !== "all" || category !== "all" || featured !== "all";
  const counts = {
    featured: all.filter((row) => row.featured).length,
    unsorted: all.filter((row) => !row.category).length,
  };
  const countSource = (key) => all.filter((row) => row.source === key).length;

  // A category picked from the filter that no longer exists falls back to every category.
  useEffect(() => {
    if (category !== "all" && category !== UNSORTED && !categories.some(([name]) => name === category)) {
      setCategory("all");
    }
  }, [categories, category]);

  const tick = (ids, on) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const sortBy = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DESCENDING_FIRST.has(key) ? "desc" : "asc" }
    );

  const clearFilters = () => {
    setQuery("");
    setSource("all");
    setCategory("all");
    setFeatured("all");
  };

  // Runs a change that isn't a form of its own; failures land in the notice.
  const run = async (action, done, failed) => {
    setBusy(true);
    try {
      const result = await action();
      await changed(done(result));
    } catch (failure) {
      setNotice({ tone: "error", text: `${failed}: ${failure.message}` });
    }
    setBusy(false);
  };

  const add = async (draft) => {
    await api.saveBorg(draft);
    await changed(`Added ${draft.name.trim()}.`);
  };

  const save = async (row, draft) => {
    await api.saveBorg({ id: row.id, ...draft });
    setEditing(null);
    const name = draft.name.trim();
    await changed(name === row.name ? `Saved ${name}.` : `Renamed ${row.name} to ${name}.`);
  };

  const feature = (row) =>
    run(
      () => api.setFeatured([row.id], !row.featured),
      () => (row.featured ? `${row.name} is off the marquee.` : `${row.name} is on the marquee.`),
      `Couldn't change ${row.name}`
    );

  const featureMany = (targets, on) =>
    run(
      () => api.setFeatured(targets.map((row) => row.id), on),
      (n) => `${on ? "Featured" : "Unfeatured"} ${plural(n, "borg")}.`,
      `Couldn't ${on ? "feature" : "unfeature"} those borgs`
    );

  const categorizeMany = (targets, value) => {
    const name = value.trim();
    return run(
      () => api.setCategory(targets.map((row) => row.id), name),
      (n) => (name ? `Moved ${plural(n, "borg")} to ${name}.` : `Cleared the category of ${plural(n, "borg")}.`),
      "Couldn't change the category"
    );
  };

  const remove = (targets) => {
    const members = targets.filter((row) => row.source === "member").length;
    const one = targets.length === 1;
    const what = one ? targets[0].name : plural(targets.length, "borg");
    let senders = `${fmt(members)} of them ${members === 1 ? "was" : "were"}`;
    if (members === targets.length) senders = one ? "It was" : "They were";
    const sentIn =
      members === 1
        ? "sent in by a member: the submission is marked rejected and leaves the wall."
        : "sent in by members: their submissions are marked rejected and leave the wall.";
    const memberNote = members ? ` ${senders} ${sentIn}` : "";
    const gone = one ? "It comes" : "They come";
    if (!window.confirm(`Delete ${what}? ${gone} off the board and out of the generator.${memberNote}`)) return;
    run(
      () => api.deleteBorgs(targets.map((row) => row.id)),
      (n) => {
        tick(
          targets.map((row) => row.id),
          false
        );
        return targets.length === 1 && n === 1 ? `Deleted ${targets[0].name}.` : `Deleted ${plural(n, "borg")}.`;
      },
      `Couldn't delete ${what}`
    );
  };

  const loading = status === "loading";

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Borgs.</h1>
          {rows && (
            <p className="dash-meta">
              <span>{plural(all.length, "borg")} on the board</span>
              <span>{fmt(counts.featured)} featured</span>
              <span>{fmt(counts.unsorted)} without a category</span>
              {loadedAt && (
                <span title={loadedAt.toLocaleString()}>
                  Updated {loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="dash-controls">
          <button type="button" className="btn btn-acid btn-sm" onClick={() => setAdding(true)} disabled={adding || !rows}>
            Add borg
          </button>
          <button type="button" className="btn btn-ghost btn-sm dash-refresh" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      <datalist id={CATEGORY_LIST_ID}>
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {notice && (
        <div className={`dash-banner ${notice.tone === "error" ? "is-error" : "is-quiet"}`} role="status">
          <span>{notice.text}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {status === "error" && rows && (
        <div className="dash-banner is-error" role="alert">
          <span>Couldn't refresh ({error}). Showing what was loaded before.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {rows ? (
        <div className={`dash-body borgs${loading ? " is-loading" : ""}`} aria-busy={loading}>
          {adding && <AddBorg onAdd={add} onClose={() => setAdding(false)} />}

          <Panel
            title="Every borg"
            sub={filtering ? `${plural(shown.length, "match", "matches")} of ${fmt(all.length)}` : "Click a column to sort"}
          >
            <div className="borgs-filters">
              <input
                className="studio-input borgs-search"
                type="search"
                value={query}
                placeholder="Search borgs"
                aria-label="Search borgs"
                onChange={(event) => setQuery(event.target.value)}
              />
              <Seg
                label="Filter by source"
                value={source}
                onChange={setSource}
                options={[
                  { key: "all", label: `All ${fmt(all.length)}` },
                  ...SOURCE_ORDER.map((key) => ({ key, label: `${SOURCES[key].label} ${fmt(countSource(key))}` })),
                ]}
              />
              <select
                className="studio-input"
                value={category}
                aria-label="Filter by category"
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">Every category</option>
                <option value={UNSORTED}>No category ({fmt(counts.unsorted)})</option>
                {categories.map(([name, n]) => (
                  <option key={name} value={name}>
                    {name} ({fmt(n)})
                  </option>
                ))}
              </select>
              <Seg
                label="Filter by featured"
                value={featured}
                onChange={setFeatured}
                options={[
                  { key: "all", label: "Any" },
                  { key: "yes", label: "★ Featured" },
                  { key: "no", label: "Not featured" },
                ]}
              />
              {filtering && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>

            {selectedRows.length > 0 && (
              <BulkBar
                rows={selectedRows}
                hidden={hiddenSelected}
                busy={busy}
                onCategory={categorizeMany}
                onFeature={featureMany}
                onDelete={remove}
                onClear={() => setSelected(new Set())}
              />
            )}

            {all.length === 0 ? (
              <Empty>No borgs on the board. Add one to get the generator rolling.</Empty>
            ) : (
              <div className="dash-table-scroll">
                <table className="dash-table borgs-table">
                  <thead>
                    <tr>
                      <th scope="col" className="borgs-check-cell">
                        <SelectAll rows={shown} selected={selected} onChange={tick} />
                      </th>
                      <SortHeader id="name" label="Name" sort={sort} onSort={sortBy} />
                      <SortHeader id="original" label="Original" sort={sort} onSort={sortBy} />
                      <SortHeader id="source" label="Source" sort={sort} onSort={sortBy} />
                      <SortHeader id="category" label="Category" sort={sort} onSort={sortBy} />
                      <SortHeader id="featured" label="★" sort={sort} onSort={sortBy} className="borgs-center" />
                      <SortHeader id="likes" label="Likes" sort={sort} onSort={sortBy} className="borgs-num" />
                      <SortHeader id="rolls" label="Rolls" sort={sort} onSort={sortBy} className="borgs-num" />
                      <SortHeader id="added" label="Added" sort={sort} onSort={sortBy} className="borgs-num" />
                      <th scope="col" className="borgs-actions">
                        <span className="borgs-sr">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr className="borgs-row-note">
                        <td colSpan={COLUMNS}>
                          <Empty>
                            No borgs match.{" "}
                            <button type="button" className="borgs-link" onClick={clearFilters}>
                              Clear filters
                            </button>
                          </Empty>
                        </td>
                      </tr>
                    ) : (
                      shown.map((row) =>
                        row.id === editing ? (
                          <EditRow key={row.id} row={row} onSave={save} onCancel={() => setEditing(null)} />
                        ) : (
                          <ViewRow
                            key={row.id}
                            row={row}
                            ticked={selected.has(row.id)}
                            busy={busy}
                            onTick={tick}
                            onEdit={(target) => setEditing(target.id)}
                            onFeature={feature}
                            onDelete={remove}
                          />
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : status === "error" ? (
        <div className="dash-failed" role="alert">
          <p className="dash-panel-title">Couldn't load the borgs.</p>
          <p className="dash-note">{error}</p>
          <button type="button" className="btn btn-acid btn-sm" onClick={load}>
            Try again
          </button>
        </div>
      ) : (
        <Panel title="Every borg" sub="Loading">
          <Empty>Counting borgs…</Empty>
        </Panel>
      )}
    </>
  );
}
