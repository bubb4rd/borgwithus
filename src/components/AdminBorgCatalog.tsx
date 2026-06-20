import { useEffect, useMemo, useState } from "react";
import ScrollHintList from "./ScrollHintList";
import {
  BORG_KIND_LABELS,
  catalogUpdateEventName,
  formatTagLabel,
  getEntryCatalogTag,
  getCatalogCustomTags,
  getFullCatalog,
  tagBadgeClass,
  type BorgCatalogEntry,
  type BorgKind,
} from "../lib/borgCatalog";import {
  ADMIN_LIST_FILTER_ROW_CLASS,
  ADMIN_LIST_TABLE_CLASS,
} from "../lib/adminListLayout";

function KindBadge({ kind }: { kind: BorgKind }) {  return (
    <span className="admin-kind-badge inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
      {BORG_KIND_LABELS[kind]}
    </span>
  );
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

export default function AdminBorgCatalog() {
  const [entries, setEntries] = useState<BorgCatalogEntry[]>([]);
  const [filter, setFilter] = useState<BorgCatalogFilter>({ mode: "all" });

  useEffect(() => {
    const refresh = () => setEntries(getFullCatalog());
    refresh();
    window.addEventListener(catalogUpdateEventName(), refresh);
    return () => window.removeEventListener(catalogUpdateEventName(), refresh);
  }, []);

  const customTags = useMemo(() => getCatalogCustomTags(entries), [entries]);

  const visible = useMemo(() => {
    if (filter.mode === "all") return entries;
    if (filter.mode === "kind") {
      return entries.filter((entry) => entry.kind === filter.value);
    }
    return entries.filter((entry) => getEntryCatalogTag(entry) === filter.value);
  }, [entries, filter]);

  return (    <>
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
        <ScrollHintList
          refreshDeps={[visible.length, entries.length, filter]}
        >
          <table className={ADMIN_LIST_TABLE_CLASS}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Tag</th>
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
    </>
  );
}
