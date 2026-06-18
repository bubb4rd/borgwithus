import BorgOfTheDay from "../components/BorgOfTheDay";
import DashboardProfileCard from "../components/DashboardProfileCard";
import DashboardShell from "../components/DashboardShell";
import GeneratorCTA from "../components/GeneratorCTA";
import LeaderboardCallout from "../components/LeaderboardCallout";
import RecentRolls from "../components/RecentRolls";

const HISTORY_PREVIEW = 4;

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="mb-6 grid gap-4 lg:grid-cols-2 lg:items-start">
        <GeneratorCTA />
        <BorgOfTheDay />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        <DashboardProfileCard />
        <RecentRolls
          limit={HISTORY_PREVIEW}
          viewAllHref="/dashboard/history"
        />
        <LeaderboardCallout />
      </div>
    </DashboardShell>
  );
}
