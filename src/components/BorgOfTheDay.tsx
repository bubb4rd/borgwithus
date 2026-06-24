import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  formatBorgOfTheDayDate,
  getBestBorgOfTheDayAllTime,
  getBorgOfTheDayStats,
  likeBorgOfTheDay,
  rateBorgOfTheDay,
} from "../lib/borgOfTheDay";
import { getDayKey } from "../lib/leaderboard";
import StarRating from "./StarRating";

const ADMIN_BOTD_GAP = "gap-[0.45rem]";
const ADMIN_BOTD_INNER_GAP = "gap-[0.6125rem]";

function AdminBotdSection({
  label,
  name,
  meta,
  date,
  eyebrow,
  averageRating,
  ratingCount,
  likeCount,
  isToday = false,
  compact = false,
}: {
  label?: string;
  name: string;
  meta?: string;
  date?: string;
  eyebrow?: string;
  averageRating: number;
  ratingCount: number;
  likeCount: number;
  isToday?: boolean;
  compact?: boolean;
}) {
  const dayLabel = isToday ? "today" : "that day";
  const ratingText =
    ratingCount > 0
      ? `${ratingCount} rating${ratingCount === 1 ? "" : "s"} ${dayLabel}`
      : `No ratings ${dayLabel}`;
  const likeText =
    likeCount > 0
      ? `${likeCount.toLocaleString()} likes ${dayLabel}`
      : `No likes ${dayLabel}`;

  if (compact) {
    return (
      <div className={`admin-botd-compact flex min-w-0 flex-col ${ADMIN_BOTD_GAP}`}>
        {eyebrow ? (
          <p className="admin-botd-eyebrow m-0 dash-eyebrow leading-tight !text-hazard">
            {eyebrow}
          </p>
        ) : null}
        <p className="admin-botd-date m-0 text-xs leading-tight text-muted sm:text-sm">
          {date}
        </p>
        <h2 className="admin-botd-name m-0 truncate text-base font-bold leading-tight text-foreground sm:text-lg">
          {name}
        </h2>
        <div className={`admin-botd-rating-row flex min-w-0 items-center ${ADMIN_BOTD_INNER_GAP}`}>
          <StarRating
            value={averageRating}
            size="xl"
            starClassName="text-botd-star"
            className="admin-botd-stars min-w-0 shrink"
          />
          <p className="admin-botd-rating-score m-0 text-base font-bold tabular-nums leading-none text-foreground">
            {ratingCount > 0 ? averageRating.toFixed(1) : "—"}
          </p>
        </div>
        <p className="admin-botd-rating-label m-0 truncate text-sm font-bold leading-tight text-muted">
          {ratingText}
        </p>
        <p className="admin-botd-like-label m-0 truncate text-sm font-bold leading-tight tabular-nums">
          {likeText}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </p>
      <h2 className="mt-[0.2rem] truncate text-sm font-bold text-foreground sm:text-base">
        {name}
      </h2>
      {meta && <p className="mt-[0.2rem] text-[0.6875rem] text-muted">{meta}</p>}
      <div className="mt-[0.35rem] flex flex-wrap items-center gap-1.5">
        <StarRating value={averageRating} size="sm" starClassName="text-botd-star" />
        <p className="text-base font-bold tabular-nums text-foreground">
          {ratingCount > 0 ? averageRating.toFixed(1) : "—"}
        </p>
        <p className="w-full text-xs text-muted">{ratingText}</p>
      </div>
      <p className="mt-[0.35rem] tabular-nums text-lg font-bold text-cyan sm:text-xl">
        {likeCount > 0 ? (
          <>
            {likeCount.toLocaleString()}{" "}
            <span className="text-xs font-semibold sm:text-sm">
              likes {dayLabel}
            </span>
          </>
        ) : (
          <span className="text-xs font-semibold sm:text-sm">
            No likes {dayLabel}
          </span>
        )}
      </p>
    </div>
  );
}

export default function BorgOfTheDay({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(() => getBorgOfTheDayStats());
  const [best, setBest] = useState(() => getBestBorgOfTheDayAllTime());

  const refresh = useCallback(() => {
    if (!admin && !user?.id) return;
    setStats(getBorgOfTheDayStats());
    if (admin) {
      setBest(getBestBorgOfTheDayAllTime());
    }
  }, [admin, user?.id]);

  useEffect(() => {
    refresh();
    window.addEventListener("leaderboard:update", refresh);
    window.addEventListener("user-data:update", refresh);
    return () => {
      window.removeEventListener("leaderboard:update", refresh);
      window.removeEventListener("user-data:update", refresh);
    };
  }, [refresh]);

  const handleLike = () => {
    if (stats.liked) return;
    likeBorgOfTheDay();
    refresh();
  };

  const handleRate = (stars: number) => {
    if (stats.rated) return;
    rateBorgOfTheDay(stars);
    refresh();
  };

  if (admin) {
    return (
      <section
        className={`dashboard-panel admin-top-card admin-botd-panel @container/admin-botd flex flex-col ${ADMIN_BOTD_GAP} p-[0.8rem] sm:p-4`}
      >
        <p className="m-0 dash-eyebrow shrink-0 leading-tight text-subtle">
          BORG of the day
        </p>

        <div className={`flex min-h-0 flex-1 flex-col justify-start ${ADMIN_BOTD_GAP}`}>
          <AdminBotdSection
            compact
            date={formatBorgOfTheDayDate(getDayKey())}
            name={stats.name}
            averageRating={stats.dayStats.averageRating}
            ratingCount={stats.dayStats.ratingCount}
            likeCount={stats.dayStats.likeCount}
            isToday
          />

          <div
            className="shrink-0 border-t border-[var(--dash-border)]"
            aria-hidden
          />
          <AdminBotdSection
            compact
            eyebrow="BORG of all time"
            date={formatBorgOfTheDayDate(best.day)}
            name={best.name}
            averageRating={best.averageRating}
            ratingCount={best.ratingCount}
            likeCount={best.likeCount}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col p-5">
      <p className="dash-eyebrow text-hazard">BORG of the day</p>
      <h2 className="mt-1 truncate text-lg font-bold text-foreground sm:text-xl">
        {stats.name}
      </h2>

      <p className="mt-1.5 text-sm text-muted">
        Like and rate today&apos;s featured name on the leaderboard.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {!stats.liked && (
          <button
            type="button"
            onClick={handleLike}
            aria-label="Like this borg"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 text-base font-semibold text-cyan transition-colors hover:bg-cyan/20"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Like
          </button>
        )}

        <StarRating
          size="lg"
          value={stats.rating}
          starClassName="text-botd-star"
          onChange={stats.rated ? undefined : handleRate}
        />
      </div>

      <p className="mt-auto pt-3 text-xl font-bold tabular-nums text-cyan sm:text-2xl">
        {stats.likeCount.toLocaleString()}{" "}
        <span className="text-base font-semibold sm:text-lg">
          community likes
        </span>
      </p>
    </section>
  );
}
