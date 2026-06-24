import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AIFeatureCallout() {
  const { user } = useAuth();

  return (
    <section className="px-4 py-8 md:px-8">
      <div data-reveal className="site-container">
        <Link
          to={user ? "/dashboard/generator" : "/signup"}
          className="ai-cta-banner group"
        >
          <div className="ai-cta-banner__glow" aria-hidden />
          <div className="ai-cta-banner__shade" aria-hidden />

          <div className="ai-cta-banner__content">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white/90">
                New
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-white/90">
                Members only
              </span>
            </div>

            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              <svg
                className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
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

            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              Describe your vibe and roll a custom BORG name with AI. Sign up
              free to unlock it in the generator dashboard.
            </p>

            <span className="ai-cta-banner__btn">
              {user ? "Try AI generator" : "Sign up free"}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
