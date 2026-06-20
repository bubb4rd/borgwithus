import { useId, useState } from "react";
import type { ChartDayBucket } from "../lib/adminStats";

export type AdminChartMetricKind = "users" | "generations";

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

const STEP_CORNER_RADIUS = 6.5;
const CORNER_ARC_KAPPA = 0.5522847498;

type ChartPoint = { x: number; y: number };

function distance(a: ChartPoint, b: ChartPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function cornerRadiusForSegment(
  lengthIn: number,
  lengthOut: number,
  maxRadius = STEP_CORNER_RADIUS,
) {
  if (lengthIn < 0.001 || lengthOut < 0.001) return 0;
  return Math.min(maxRadius, lengthIn * 0.56, lengthOut * 0.56);
}

function roundedCornerCommand(
  prev: ChartPoint,
  curr: ChartPoint,
  next: ChartPoint,
  radius: number,
) {
  const lenIn = distance(prev, curr);
  const lenOut = distance(curr, next);
  const inX = (curr.x - prev.x) / lenIn;
  const inY = (curr.y - prev.y) / lenIn;
  const outX = (next.x - curr.x) / lenOut;
  const outY = (next.y - curr.y) / lenOut;

  const startX = curr.x - inX * radius;
  const startY = curr.y - inY * radius;
  const endX = curr.x + outX * radius;
  const endY = curr.y + outY * radius;
  const handle = radius * CORNER_ARC_KAPPA;

  return (
    ` L ${startX} ${startY}` +
    ` C ${startX + inX * handle} ${startY + inY * handle}` +
    ` ${endX - outX * handle} ${endY - outY * handle}` +
    ` ${endX} ${endY}`
  );
}

function buildStepVertices(points: ChartPoint[]) {
  if (points.length === 0) return [];
  const vertices: ChartPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const corner = { x: points[i].x, y: points[i - 1].y };
    const last = vertices[vertices.length - 1];
    if (last.x !== corner.x || last.y !== corner.y) vertices.push(corner);
    if (corner.x !== points[i].x || corner.y !== points[i].y) vertices.push(points[i]);
  }

  return vertices;
}

function buildRoundedOpenPath(vertices: ChartPoint[], maxRadius = STEP_CORNER_RADIUS) {
  if (vertices.length === 0) return "";
  if (vertices.length === 1) return `M ${vertices[0].x} ${vertices[0].y}`;
  if (vertices.length === 2) {
    return `M ${vertices[0].x} ${vertices[0].y} L ${vertices[1].x} ${vertices[1].y}`;
  }

  let path = `M ${vertices[0].x} ${vertices[0].y}`;

  for (let i = 1; i < vertices.length - 1; i++) {
    const prev = vertices[i - 1];
    const curr = vertices[i];
    const next = vertices[i + 1];
    const lenIn = distance(prev, curr);
    const lenOut = distance(curr, next);
    const radius = cornerRadiusForSegment(lenIn, lenOut, maxRadius);

    if (radius <= 0.01) {
      path += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    path += roundedCornerCommand(prev, curr, next, radius);
  }

  const last = vertices[vertices.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

function buildRoundedClosedPath(vertices: ChartPoint[], maxRadius = STEP_CORNER_RADIUS) {
  const count = vertices.length;
  if (count < 3) return buildRoundedOpenPath(vertices, maxRadius);

  const starts: ChartPoint[] = [];
  const ends: ChartPoint[] = [];
  const cornerRadii: number[] = [];

  for (let i = 0; i < count; i++) {
    const prev = vertices[(i - 1 + count) % count];
    const curr = vertices[i];
    const next = vertices[(i + 1) % count];
    const lenIn = distance(prev, curr);
    const lenOut = distance(curr, next);
    const radius = cornerRadiusForSegment(lenIn, lenOut, maxRadius);

    if (radius <= 0.01) {
      starts[i] = curr;
      ends[i] = curr;
      cornerRadii[i] = 0;
      continue;
    }

    const inX = (curr.x - prev.x) / lenIn;
    const inY = (curr.y - prev.y) / lenIn;
    const outX = (next.x - curr.x) / lenOut;
    const outY = (next.y - curr.y) / lenOut;

    starts[i] = {
      x: curr.x - inX * radius,
      y: curr.y - inY * radius,
    };
    ends[i] = {
      x: curr.x + outX * radius,
      y: curr.y + outY * radius,
    };
    cornerRadii[i] = radius;
  }

  let path = `M ${ends[count - 1].x} ${ends[count - 1].y}`;
  for (let i = 0; i < count; i++) {
    path += ` L ${starts[i].x} ${starts[i].y}`;
    if (cornerRadii[i] > 0.01) {
      const prev = vertices[(i - 1 + count) % count];
      const next = vertices[(i + 1) % count];
      const radius = cornerRadii[i];
      const lenIn = distance(prev, vertices[i]);
      const lenOut = distance(vertices[i], next);
      const inX = (vertices[i].x - prev.x) / lenIn;
      const inY = (vertices[i].y - prev.y) / lenIn;
      const outX = (next.x - vertices[i].x) / lenOut;
      const outY = (next.y - vertices[i].y) / lenOut;
      const handle = radius * CORNER_ARC_KAPPA;

      path +=
        ` C ${starts[i].x + inX * handle} ${starts[i].y + inY * handle}` +
        ` ${ends[i].x - outX * handle} ${ends[i].y - outY * handle}` +
        ` ${ends[i].x} ${ends[i].y}`;
    }
  }
  path += " Z";
  return path;
}

function buildStepLinePath(points: ChartPoint[]) {
  return buildRoundedOpenPath(buildStepVertices(points));
}

function buildStepAreaPath(points: ChartPoint[], baselineY: number) {
  if (points.length === 0) return "";
  const topVertices = buildStepVertices(points);
  const closedVertices = [
    ...topVertices,
    { x: points[points.length - 1].x, y: baselineY },
    { x: points[0].x, y: baselineY },
  ];
  return buildRoundedClosedPath(closedVertices);
}

function formatDayLabel(dayKey: string) {
  const parsed = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dayKey;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMetricCount(count: number, metricKind: AdminChartMetricKind) {
  if (metricKind === "users") {
    return count === 1 ? "1 user" : `${count} users`;
  }
  return count === 1 ? "1 borg generated" : `${count} borgs generated`;
}

export default function AdminSignupLineChart({
  buckets,
  metricKind,
}: {
  buckets: ChartDayBucket[];
  metricKind: AdminChartMetricKind;
}) {
  const hatchId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
  const xBound = (index: number) =>
    count <= 1
      ? index === 0
        ? pad.left
        : pad.left + plotW
      : pad.left + (index / count) * plotW;
  const xCenter = (index: number) =>
    count <= 1
      ? pad.left + plotW / 2
      : pad.left + ((index + 0.5) / count) * plotW;

  const yAt = (value: number) => pad.top + plotH - (value / yMax) * plotH;

  const points = buckets.map((bucket, index) => ({
    x: xBound(index),
    y: yAt(bucket.count),
    label: bucket.label,
    count: bucket.count,
  }));

  if (points.length > 0) {
    const last = points[points.length - 1];
    points.push({
      x: xBound(count),
      y: last.y,
      label: last.label,
      count: last.count,
    });
  }

  const areaPath = buildStepAreaPath(points, baselineY);
  const linePath = buildStepLinePath(points);
  const activeBucket = activeIndex === null ? null : buckets[activeIndex];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 gap-1.5">
        <div className="flex w-5 shrink-0 flex-col justify-between self-stretch py-0.5 text-right">
          {[...yTicks].reverse().map((tick) => (
            <span
              key={tick}
              className="text-[0.6rem] font-medium leading-none tabular-nums text-[var(--dash-muted)]"
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-h-0 min-w-0 flex-1">
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

            {buckets.map((bucket, index) => {
              const x = xCenter(index);
              return (
              <line
                key={`v-${bucket.dayKey}`}
                x1={x}
                y1={pad.top}
                x2={x}
                y2={baselineY}
                className={`admin-signup-chart-grid-v transition-opacity ${
                  activeIndex === null || activeIndex === index
                    ? "opacity-100"
                    : "opacity-35"
                }`}
              />
            );
            })}

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

          <div className="absolute inset-0 flex pl-0">
            {buckets.map((bucket, index) => (
              <div
                key={bucket.dayKey}
                className="relative h-full flex-1"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span className="sr-only">
                  {formatDayLabel(bucket.dayKey)}:{" "}
                  {formatMetricCount(bucket.count, metricKind)}
                </span>
              </div>
            ))}
          </div>

          {activeBucket && activeIndex !== null ? (
            <div
              className="pointer-events-none absolute bottom-[22%] z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm"
              style={{
                left: `${((activeIndex + 0.5) / buckets.length) * 100}%`,
              }}
            >
              <p className="whitespace-nowrap font-medium text-foreground">
                {formatDayLabel(activeBucket.dayKey)}
              </p>
              <p className="mt-0.5 whitespace-nowrap tabular-nums text-[var(--dash-muted)]">
                {formatMetricCount(activeBucket.count, metricKind)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-1 flex shrink-0 justify-between pl-6 pr-1">
        {buckets.map((bucket, index) => (
          <span
            key={bucket.dayKey}
            className={`flex-1 text-center text-[0.65rem] font-medium transition-colors sm:text-xs ${
              activeIndex === index
                ? "text-foreground"
                : "text-[var(--dash-muted)]"
            }`}
          >
            {bucket.label}
          </span>
        ))}
      </div>
    </div>
  );
}
