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
      className="group dashboard-panel flex flex-col overflow-hidden transition hover:border-cyan/40"
    >
      <div className="p-3.5 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
          Generator
        </p>
        <h2 className="mt-0.5 text-lg font-bold text-foreground">
          Roll your next borg name
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Classic BORG &amp; MIO, plus AI. Pick a favorite and save it to
          history.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MODES.map((mode) => (
            <span
              key={mode}
              className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${TYPE_STYLES[mode]}`}
            >
              {ROLL_LABELS[mode]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-gradient-to-br from-cyan to-magenta px-4 py-2.5 transition group-hover:opacity-95">
        <span className="text-sm font-semibold text-white">Roll now</span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-base text-white transition group-hover:translate-x-0.5"
          aria-hidden
        >
          →
        </span>
      </div>
    </Link>
  );
}
