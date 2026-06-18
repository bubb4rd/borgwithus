import { Link } from "react-router-dom";

export default function DashboardGeneratorPulse() {
  return (
    <section className="dash-promo-card flex flex-col rounded-[1.35rem] p-5">
      <p className="text-sm font-medium text-white/80">Quick roll</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-white tabular-nums">
        BORG
      </p>
      <p className="mt-1 text-xs text-white/70">Tap to spin the generator</p>

      <div className="mt-auto flex items-center justify-center gap-3 pt-8">
        <Link
          to="/dashboard/generator"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          aria-label="Open generator"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </Link>
        <Link
          to="/dashboard/generator"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-cyan shadow-lg transition hover:scale-105"
          aria-label="Roll now"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </Link>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white/50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </span>
      </div>
    </section>
  );
}
