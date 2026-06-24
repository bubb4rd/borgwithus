import DashboardPageHeader from "../components/DashboardPageHeader";
import DashboardShell from "../components/DashboardShell";
import SavedLikes from "../components/SavedLikes";
import RecentRolls from "../components/RecentRolls";

const HISTORY_SCROLL_HEIGHT = 380;

export default function HistoryPage() {
  return (
    <DashboardShell>
      <DashboardPageHeader
        title="History"
        description="Full list of your saved likes and generator rolls."
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
        <SavedLikes scrollable scrollHeight={HISTORY_SCROLL_HEIGHT} />
        <RecentRolls scrollable scrollHeight={HISTORY_SCROLL_HEIGHT} />
      </div>
    </DashboardShell>
  );
}
