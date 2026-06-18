import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AIFeatureCallout() {
  const { user } = useAuth();

  return (
    <section className="px-4 pb-4 md:px-8">
      <div data-reveal className="mx-auto max-w-6xl">
        <Link
          to={user ? "/dashboard/generator" : "/signup"}
          className="group glass glow-magenta block overflow-hidden rounded-3xl border border-magenta/25 transition hover:border-magenta/45 sm:grid sm:grid-cols-[1fr_auto]"
        >
          <div className="relative p-6 sm:p-8">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-magenta/15 blur-2xl"
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
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                BORG AI
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
                Describe your vibe and roll a custom BORG name with AI. Sign up
                free to unlock it in the dashboard generator.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 border-t border-border bg-gradient-to-br from-magenta to-hazard px-8 py-5 transition group-hover:opacity-95 sm:border-l sm:border-t-0 sm:py-0">
            <span className="text-sm font-semibold text-white sm:hidden">
              {user ? "Try AI generator" : "Sign up free"}
            </span>
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl text-white transition group-hover:translate-x-0.5"
              aria-hidden
            >
              →
            </span>
            <span className="hidden text-sm font-semibold text-white sm:inline">
              {user ? "Try AI generator" : "Sign up free"}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
