import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AIFeatureCallout() {
  const { user } = useAuth();

  return (
    <section className="px-4 pb-4 md:px-8">
      <div data-reveal className="mx-auto max-w-6xl">
        <Link
          to={user ? "/dashboard/generator" : "/signup"}
          className="group glass glow-magenta-soft block overflow-hidden rounded-3xl border border-magenta/25 transition hover:border-magenta/45 sm:grid sm:grid-cols-[1fr_auto]"
        >
          <div className="relative p-6 sm:p-8">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-magenta/10 blur-xl"
              aria-hidden
            />
            <div className="relative">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-hazard/30 bg-hazard/10 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-hazard">
                  New
                </span>
                <span className="rounded-full border border-magenta/30 bg-magenta/10 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-magenta">
                  Members only
                </span>
              </div>
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
                <svg
                  className="h-[1.828125rem] w-[1.828125rem] shrink-0 sm:h-[2.03125rem] sm:w-[2.03125rem]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="5" cy="6" r="2" />
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="5" cy="18" r="2" />
                  <circle cx="12" cy="9" r="2" />
                  <circle cx="12" cy="15" r="2" />
                  <circle cx="19" cy="12" r="2" />
                  <path d="M7 6.5 10.2 8.3M7 12h5M7 17.5l3.2-1.8M7 11.5l3.2 1.7M14 10.2 17 11.5M14 13.8 17 12.5" />
                </svg>
                BORG AI
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
                Describe your vibe and roll a custom BORG name with AI. Sign up
                free to unlock it in the dashboard generator.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 border-t border-border bg-gradient-to-br from-magenta to-hazard px-8 py-5 transition group-hover:opacity-95 sm:flex-row-reverse sm:border-l sm:border-t-0 sm:py-0">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl text-white transition group-hover:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
            <span className="text-sm font-semibold text-white">
              {user ? "Try AI generator" : "Sign up free"}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
