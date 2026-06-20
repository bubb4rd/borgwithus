import { formatCompactRollCount } from "../lib/adminStats";

export default function AdminCatalogStatsCard({ totalRolls }: { totalRolls: number }) {
  return (
    <section className="admin-lifetime-borgs-chip @container flex flex-col items-center justify-center p-2 sm:p-2.5">
      <p className="text-center text-[length:clamp(2.25rem,42cqw,3.75rem)] font-bold leading-none tabular-nums text-white dark:text-[var(--admin-bg-page)]">
        {formatCompactRollCount(totalRolls)}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 dark:text-[var(--admin-bg-page)]">
        Lifetime BORGs
      </p>
    </section>
  );
}
