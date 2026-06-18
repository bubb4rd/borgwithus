import DashboardShell from "../components/DashboardShell";
import Generator from "../components/Generator";
import AIGenerator from "../components/AIGenerator";

export default function GeneratorPage() {
  return (
    <DashboardShell>
      <div className="space-y-8">
        <Generator embedded compact />
        <AIGenerator embedded />
      </div>
    </DashboardShell>
  );
}
