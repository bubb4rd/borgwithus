import DashboardShell from "../components/DashboardShell";
import SavedPicks from "../components/SavedPicks";
import RecentRolls from "../components/RecentRolls";

const HISTORY_SCROLL_HEIGHT = 380;

export default function HistoryPage() {
  return (
    <DashboardShell>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
          Your activity
        </p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">History</h1>
        <p className="mt-2 text-sm text-muted">
          Full list of your saved picks and generator rolls.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SavedPicks scrollable scrollHeight={HISTORY_SCROLL_HEIGHT} />
        <RecentRolls scrollable scrollHeight={HISTORY_SCROLL_HEIGHT} />
      </div>
    </DashboardShell>
  );
}
