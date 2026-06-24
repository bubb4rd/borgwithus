import DashboardPageHeader from "../components/DashboardPageHeader";
import DashboardShell from "../components/DashboardShell";
import Leaderboard from "../components/Leaderboard";

export default function LeaderboardPage() {
  return (
    <DashboardShell>
      <DashboardPageHeader
        title="Borg Hall of Fame"
        description="Top liked and top rated names from the community."
      />
      <Leaderboard embedded hideHeader />
    </DashboardShell>
  );
}
