import {
  CATALOG_MIX_CYAN_PALETTE,
  type BorgTagMixSegment,
} from "../lib/borgCatalog";
import { ADMIN_CATALOG_CHIP_CLASS } from "../lib/adminListLayout";

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
  const cy = 54;
  const radius = 40;
  const stroke = 8;

  const active = segments.filter((segment) => segment.value > 0);
  const total = active.reduce((sum, segment) => sum + segment.value, 0);
  const gapCount = Math.max(active.length + 1, 2);
  const availableSpan = ARC_SPAN - gapCount * SEGMENT_GAP_DEG;

  let cursor = ARC_START + SEGMENT_GAP_DEG;

  return (
    <div className="@container/chart relative h-full w-full min-h-0">
      <svg
        viewBox="4 8 92 50"
        className="h-full w-full"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden
      >
        <path
          d={arcPath(
            cx,
            cy,
            radius,
            ARC_START + SEGMENT_GAP_DEG,
            ARC_END - SEGMENT_GAP_DEG,
          )}
          fill="none"
          stroke={CATALOG_MIX_CYAN_PALETTE[300]}
          strokeOpacity={0.28}
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
        <p className="mt-0 text-[length:clamp(0.9rem,24cqw,2rem)] font-bold tabular-nums leading-none text-[var(--dash-foreground)]">
          {centerValue}
        </p>
        <p className="mt-0.5 text-[length:clamp(0.5rem,9cqw,0.625rem)] font-medium uppercase tracking-wide text-[var(--dash-muted)]">
          {centerLabel}
        </p>
      </div>
    </div>
  );
}

export default function AdminCatalogMixCard({
  borgTotal,
  tagSegments,
}: {
  borgTotal: number;
  tagSegments: BorgTagMixSegment[];
}) {
  const segments: DonutSegment[] = tagSegments.map((segment) => ({
    label: segment.label,
    value: segment.count,
    color: segment.color,
  }));

  return (
    <section className={`${ADMIN_CATALOG_CHIP_CLASS} p-2 sm:p-2.5`}>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <div className="flex min-h-0 w-full flex-1 justify-center">
          <SemiArcChart
            segments={
              segments.length
                ? segments
                : [{ label: "Empty", value: 1, color: "var(--dash-border)" }]
            }
            centerValue={borgTotal}
            centerLabel="borgs"
          />
        </div>
        <ul className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1">
          {segments.map((segment) => {
            const pct = borgTotal
              ? Math.round((segment.value / borgTotal) * 100)
              : 0;
            return (
              <li
                key={segment.label}
                className="flex items-center gap-1 text-[0.65rem] font-medium text-[var(--dash-muted)] sm:text-[0.7rem]"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
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
    </section>
  );
}
