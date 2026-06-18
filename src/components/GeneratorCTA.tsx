import { Link } from "react-router-dom";
import { ROLL_LABELS, type RollType } from "../lib/userData";

const TYPE_STYLES: Record<RollType, string> = {
  borg: "text-cyan bg-cyan/10 border-cyan/20",
  mio: "text-magenta bg-magenta/10 border-magenta/20",
  ai: "text-hazard bg-hazard/10 border-hazard/20",
};

const MODES: RollType[] = ["borg", "mio", "ai"];

export default function GeneratorCTA() {
  return (
    <Link
      to="/dashboard/generator"
      className="group dashboard-panel dashboard-panel-interactive flex flex-col overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <p className="dash-eyebrow">Generator</p>
        <h2 className="mt-1 text-xl font-bold text-[var(--dash-foreground)]">
          Roll your next borg name
        </h2>
        <p className="mt-2 text-sm text-[var(--dash-muted)]">
          Classic BORG &amp; Mio, plus AI. Like a favorite and save it to history.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODES.map((mode) => (
            <span
              key={mode}
              className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${TYPE_STYLES[mode]}`}
            >
              {ROLL_LABELS[mode]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--dash-border)] bg-gradient-to-br from-cyan/10 to-magenta/10 px-5 py-3.5">
        <span className="text-sm font-semibold text-cyan">Roll now</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-sky-400 text-sm text-on-accent transition group-hover:translate-x-0.5"
          aria-hidden
        >
          →
        </span>
      </div>
    </Link>
  );
}
