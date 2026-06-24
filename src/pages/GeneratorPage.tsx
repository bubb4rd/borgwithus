import DashboardPageHeader from "../components/DashboardPageHeader";
import DashboardShell from "../components/DashboardShell";
import Generator from "../components/Generator";
import AIGenerator from "../components/AIGenerator";

export default function GeneratorPage() {
  return (
    <DashboardShell>
      <DashboardPageHeader
        title="Generator"
        description="Roll classic BORG & Mio names or spin up something new with AI."
      />
      <div className="space-y-6">
        <Generator embedded compact />
        <AIGenerator embedded />
      </div>
    </DashboardShell>
  );
}
