import DashboardShell from "../components/DashboardShell";
import Leaderboard from "../components/Leaderboard";

export default function LeaderboardPage() {
  return (
    <DashboardShell>
      <Leaderboard embedded />
    </DashboardShell>
  );
}
