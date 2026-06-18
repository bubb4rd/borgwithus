import { useId } from "react";
import type { SignupBucket } from "../lib/adminStats";

function getYTicks(maxValue: number) {
  if (maxValue <= 4) {
    const top = Math.max(4, maxValue);
    return Array.from({ length: top + 1 }, (_, i) => i);
  }

  const step = Math.max(1, Math.ceil(maxValue / 4));
  const top = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return ticks;
}

function buildStepLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i - 1].y} L ${points[i].x} ${points[i].y}`;
  }
  return path;
}

function buildStepAreaPath(
  points: { x: number; y: number }[],
  baselineY: number,
) {
  if (points.length === 0) return "";
  const last = points[points.length - 1];
  const first = points[0];
  return `${buildStepLinePath(points)} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export default function AdminSignupLineChart({
  buckets,
}: {
  buckets: SignupBucket[];
}) {
  const hatchId = useId().replace(/:/g, "");

  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 0);
  const yTicks = getYTicks(maxCount);
  const yMax = yTicks[yTicks.length - 1] ?? 4;

  const width = 100;
  const height = 100;
  const pad = { top: 6, right: 4, bottom: 4, left: 4 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const baselineY = pad.top + plotH;

  const count = buckets.length;
  const xAt = (index: number) =>
    count <= 1
      ? pad.left + plotW / 2
      : pad.left + (index / (count - 1)) * plotW;

  const yAt = (value: number) => pad.top + plotH - (value / yMax) * plotH;

  const points = buckets.map((bucket, index) => ({
    x: xAt(index),
    y: yAt(bucket.count),
    label: bucket.label,
    count: bucket.count,
  }));

  const areaPath = buildStepAreaPath(points, baselineY);
  const linePath = buildStepLinePath(points);

  return (
    <div className="flex h-full flex-col justify-end">
      <div className="flex gap-1.5">
        <div className="flex w-5 shrink-0 flex-col justify-between py-0.5 text-right">
          {[...yTicks].reverse().map((tick) => (
            <span
              key={tick}
              className="text-[0.6rem] font-medium leading-none tabular-nums text-[var(--dash-muted)]"
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative h-28 min-w-0 flex-1 sm:h-32">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <pattern
                id={hatchId}
                width="3"
                height="3"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(-45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="3"
                  className="admin-signup-chart-hatch"
                  strokeWidth="0.65"
                />
              </pattern>
            </defs>

            {yTicks.map((tick) => {
              const y = yAt(tick);
              return (
                <line
                  key={`h-${tick}`}
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  className="admin-signup-chart-grid-h"
                />
              );
            })}

            {points.map((point, index) => (
              <line
                key={`v-${buckets[index]?.dayKey ?? index}`}
                x1={point.x}
                y1={pad.top}
                x2={point.x}
                y2={baselineY}
                className="admin-signup-chart-grid-v"
              />
            ))}

            {areaPath ? (
              <path d={areaPath} fill={`url(#${hatchId})`} />
            ) : null}
            {linePath ? (
              <path
                d={linePath}
                className="admin-signup-chart-line"
                fill="none"
              />
            ) : null}
          </svg>
        </div>
      </div>

      <div className="mt-1 flex justify-between pl-6 pr-1">
        {buckets.map((bucket) => (
          <span
            key={bucket.dayKey}
            className="flex-1 text-center text-[0.65rem] font-medium text-[var(--dash-muted)] sm:text-xs"
          >
            {bucket.label}
          </span>
        ))}
      </div>
    </div>
  );
}
