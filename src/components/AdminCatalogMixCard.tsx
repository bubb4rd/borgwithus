type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

const ARC_START = 180;
const ARC_END = 360;
const ARC_SPAN = ARC_END - ARC_START;
const SEGMENT_GAP_DEG = 5;

function pointOnCircle(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const start = pointOnCircle(cx, cy, r, startDeg);
  const end = pointOnCircle(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function SemiArcChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerValue: string | number;
  centerLabel: string;
}) {
  const cx = 50;
  const cy = 56;
  const radius = 36;
  const stroke = 9;

  const active = segments.filter((segment) => segment.value > 0);
  const total = active.reduce((sum, segment) => sum + segment.value, 0);
  const gapCount = Math.max(active.length + 1, 2);
  const availableSpan = ARC_SPAN - gapCount * SEGMENT_GAP_DEG;

  let cursor = ARC_START + SEGMENT_GAP_DEG;

  return (
    <div className="relative w-[9.68rem] shrink-0 sm:w-[11rem]">
      <svg viewBox="0 0 100 68" className="h-auto w-full" aria-hidden>
        <path
          d={arcPath(
            cx,
            cy,
            radius,
            ARC_START + SEGMENT_GAP_DEG,
            ARC_END - SEGMENT_GAP_DEG,
          )}
          fill="none"
          stroke="color-mix(in srgb, var(--dash-muted) 22%, transparent)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {total > 0 &&
          active.map((segment) => {
            const span = (segment.value / total) * availableSpan;
            const startDeg = cursor;
            const endDeg = cursor + span;
            cursor = endDeg + SEGMENT_GAP_DEG;

            return (
              <path
                key={segment.label}
                d={arcPath(cx, cy, radius, startDeg, endDeg)}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
            );
          })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
        <p className="mt-0 text-[1.32rem] font-bold tabular-nums leading-none text-[var(--dash-foreground)] sm:text-[1.65rem]">
          {centerValue}
        </p>
        <p className="mt-0.5 text-[0.572rem] font-medium uppercase tracking-wide text-[var(--dash-muted)] sm:text-[0.66rem]">
          {centerLabel}
        </p>
      </div>
    </div>
  );
}

export default function AdminCatalogMixCard({
  borg,
  mio,
  ai,
  total,
  adminAdded,
}: {
  borg: number;
  mio: number;
  ai: number;
  total: number;
  adminAdded: number;
}) {
  const segments: DonutSegment[] = [
    { label: "BORG", value: borg, color: "var(--accent-cyan)" },
    { label: "Mio", value: mio, color: "var(--accent-lime)" },
    { label: "AI", value: ai, color: "var(--accent-magenta)" },
  ].filter((segment) => segment.value > 0);

  return (
    <section className="dashboard-panel admin-top-card flex flex-col p-[0.8rem] sm:p-4">
      <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-subtle">
        Catalog mix
      </p>

      <div className="mt-[0.6rem] flex min-h-0 flex-1 flex-col justify-between gap-2">
        <div className="shrink-0 flex flex-col gap-[0.4rem]">
          <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
            {total.toLocaleString()}
          </p>
          <p className="text-xs text-[var(--dash-muted)]">
            {adminAdded} admin-added
          </p>
        </div>

        <div className="flex min-h-0 flex-col items-center justify-end gap-[0.6rem]">
          <SemiArcChart
            segments={
              segments.length
                ? segments
                : [{ label: "Empty", value: 1, color: "var(--dash-border)" }]
            }
            centerValue={total}
            centerLabel="total"
          />
          <ul className="flex flex-wrap items-center justify-center gap-x-[0.825rem] gap-y-[0.4125rem]">
            {segments.map((segment) => {
              const pct = total ? Math.round((segment.value / total) * 100) : 0;
              return (
                <li
                  key={segment.label}
                  className="flex items-center gap-[0.4125rem] text-[0.75625rem] font-medium text-[var(--dash-muted)] sm:text-[0.825rem]"
                >
                  <span
                    className="h-[0.4125rem] w-[0.4125rem] shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  {segment.label}
                  <span className="tabular-nums text-[var(--dash-foreground)]">
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
