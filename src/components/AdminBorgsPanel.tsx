import { useEffect, useState } from "react";
import SelectMenu from "./SelectMenu";
import AdminAddBorgModal from "./AdminAddBorgModal";
import AdminAiGenerationCenter from "./AdminAiGenerationCenter";
import AdminBorgCatalog from "./AdminBorgCatalog";
import AdminUserSubmissionsCenter from "./AdminUserSubmissionsCenter";
import {
  AdminListPanelActions,
  AdminListPanelFilterButton,
  AdminListPanelProvider,
} from "./AdminListPanelContext";
import { ADMIN_LIST_PANEL_CLASS, ADMIN_LIST_PANEL_HEADER_CLASS } from "../lib/adminListLayout";
import {
  getUserSubmissions,
  userSubmissionsUpdateEventName,
} from "../lib/userSubmissions";

const VIEW_OPTIONS = [
  { value: "catalog" as const, label: "BORGs" },
  { value: "ai-lab" as const, label: "AI Generation Lab" },
  { value: "submissions" as const, label: "User submissions" },
];

type BorgView = (typeof VIEW_OPTIONS)[number]["value"];

type AdminBorgsPanelProps = {
  catalogTotal: number;
  aiGenerationTotal?: number;
};

export default function AdminBorgsPanel({
  catalogTotal,
  aiGenerationTotal,
}: AdminBorgsPanelProps) {
  const [view, setView] = useState<BorgView>("catalog");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submissionTotal, setSubmissionTotal] = useState(
    () => getUserSubmissions().length,
  );

  useEffect(() => {
    const refresh = () => setSubmissionTotal(getUserSubmissions().length);
    refresh();
    window.addEventListener(userSubmissionsUpdateEventName(), refresh);
    return () => window.removeEventListener(userSubmissionsUpdateEventName(), refresh);
  }, []);

  const countLabel =
    view === "catalog"
      ? catalogTotal.toLocaleString()
      : view === "ai-lab"
        ? aiGenerationTotal !== undefined
          ? aiGenerationTotal.toLocaleString()
          : "—"
        : submissionTotal.toLocaleString();

  return (
    <AdminListPanelProvider>
      <section className={ADMIN_LIST_PANEL_CLASS}>
        <div className={ADMIN_LIST_PANEL_HEADER_CLASS}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <SelectMenu
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
              ariaLabel="BORGs views"
              triggerClassName="text-lg font-bold"
            />
            <span className="text-base font-semibold tabular-nums text-subtle">
              {countLabel}
            </span>
          </div>

          <AdminListPanelActions>
            <AdminListPanelFilterButton />
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-cyan text-sm font-semibold text-ink shadow-md transition hover:opacity-90 md:w-auto md:px-4"
              aria-label="Add name"
              title="Add name"
            >
              <span className="text-lg font-bold leading-none">+</span>
              <span className="hidden md:inline">Add</span>
            </button>
          </AdminListPanelActions>
        </div>

        {view === "catalog" ? (
          <AdminBorgCatalog />
        ) : view === "ai-lab" ? (
          <AdminAiGenerationCenter />
        ) : (
          <AdminUserSubmissionsCenter />
        )}

        <AdminAddBorgModal
          open={showAddForm}
          onClose={() => setShowAddForm(false)}
        />
      </section>
    </AdminListPanelProvider>
  );
}
