// Pure helpers for the admin dashboard: normalise the RPC payload, derive windows,
// period-over-period changes, ratios and chart scales. No React in here.

export const RANGES = [7, 14, 30, 90];
export const DEFAULT_RANGE = 14;
// get_admin_dashboard clamps p_days to 1..90.
export const MAX_DAYS = 90;

export const KINDS = [
  { key: "borg", label: "Borg", tone: "borg" },
  { key: "mio", label: "Mio", tone: "mio" },
  { key: "ai", label: "BORG AI", tone: "ai" },
];

const TOTAL_KEYS = [
  "members",
  "confirmed",
  "borg",
  "mio",
  "ai",
  "guest_rolls",
  "likes",
  "liked_names",
  "ai_credits_today",
  "pending",
  "approved",
  "rejected",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

export function parseRange(value) {
  const n = Number(value);
  return RANGES.includes(n) ? n : DEFAULT_RANGE;
}

// Twice the range so the window can be compared with the one before it, within the RPC's cap.
export const fetchDays = (range) => Math.min(range * 2, MAX_DAYS);

export function normalize(raw) {
  const totals = Object.fromEntries(TOTAL_KEYS.map((key) => [key, num(raw?.totals?.[key])]));
  const series = (raw?.series ?? []).map((row) => {
    const borg = num(row.borg);
    const mio = num(row.mio);
    const ai = num(row.ai);
    return { day: row.day, members: num(row.members), borg, mio, ai, rolls: borg + mio + ai };
  });
  return {
    timezone: raw?.timezone || "UTC",
    totals,
    series,
    recentMembers: raw?.recent_members ?? [],
    recentRolls: raw?.recent_rolls ?? [],
    topLiked: (raw?.top_liked ?? []).map((row) => ({ name: row.name, likes: num(row.likes) })),
  };
}

function metric(current, previous, key) {
  const values = current.map((row) => row[key]);
  const total = values.reduce((a, b) => a + b, 0);
  let peak = null;
  values.forEach((value, i) => {
    if (value > 0 && (!peak || value >= peak.value)) peak = { value, day: current[i].day };
  });
  return {
    key,
    values,
    total,
    prev: previous ? sum(previous, key) : null,
    avg: current.length ? total / current.length : 0,
    prevAvg: previous && previous.length ? sum(previous, key) / previous.length : null,
    peak,
    activeDays: values.filter((value) => value > 0).length,
  };
}

export const ratio = (part, whole) => (whole > 0 ? part / whole : null);

export function derive(data, range) {
  const all = data.series;
  const n = Math.min(range, all.length);
  const current = all.slice(all.length - n);
  const previous = n > 0 && all.length >= 2 * n ? all.slice(all.length - 2 * n, all.length - n) : null;
  const metrics = Object.fromEntries(
    ["members", "borg", "mio", "ai", "rolls"].map((key) => [key, metric(current, previous, key)])
  );

  const t = data.totals;
  const allRolls = t.borg + t.mio + t.ai;
  const memberRolls = Math.max(0, allRolls - t.guest_rolls);

  // Members at the end of each day, walking back from today's total.
  const membersAtStart = Math.max(0, t.members - metrics.members.total);
  let running = membersAtStart;
  const membersCurve = current.map((row) => (running += row.members));

  // Today is the last (partial) day; "typical" days are the full days before it in the window.
  const today = current[n - 1] ?? null;
  const fullDays = current.slice(0, -1);
  const typical = (key) => (fullDays.length ? sum(fullDays, key) / fullDays.length : null);
  const lastWeek = all.length >= 8 ? all[all.length - 8] : null;

  // Weekday pattern over every full day fetched (up to 2x the range).
  const pool = all.slice(0, -1);
  const buckets = WEEKDAYS.map((label) => ({ label, days: 0, rolls: 0, members: 0 }));
  pool.forEach((row) => {
    const bucket = buckets[(parseDay(row.day).getDay() + 6) % 7];
    bucket.days += 1;
    bucket.rolls += row.rolls;
    bucket.members += row.members;
  });
  const weekdays = buckets.map((b) => ({
    label: b.label,
    days: b.days,
    rolls: b.days ? b.rolls / b.days : 0,
    members: b.days ? b.members / b.days : 0,
  }));

  const decided = t.approved + t.rejected;
  const recentMembers = data.recentMembers;
  const topLikedSum = data.topLiked.reduce((total, row) => total + row.likes, 0);

  return {
    n,
    current,
    previous,
    metrics,
    allRolls,
    memberRolls,
    membersAtStart,
    membersCurve,
    growth: membersAtStart > 0 ? metrics.members.total / membersAtStart : null,
    today,
    typical,
    lastWeek,
    weekdays,
    weekdayPool: pool.length,
    confirmRate: ratio(t.confirmed, t.members),
    guestShare: ratio(t.guest_rolls, allRolls),
    rollsPerMember: t.members > 0 ? memberRolls / t.members : null,
    windowShare: ratio(metrics.rolls.total, allRolls),
    decided,
    approvalRate: ratio(t.approved, decided),
    likesPerName: t.liked_names > 0 ? t.likes / t.liked_names : null,
    topLikedSum,
    topLikedShare: ratio(topLikedSum, t.likes),
    recentMembersCount: recentMembers.length,
    recentConfirmed: recentMembers.filter((row) => row.confirmed).length,
    recentSignedIn: recentMembers.filter((row) => row.last_sign_in_at).length,
    recentGuestRolls: data.recentRolls.filter((row) => !row.member).length,
  };
}

// Share of each kind within a set of counts, for the mix bars.
export function mix(counts) {
  const total = KINDS.reduce((s, kind) => s + counts[kind.key], 0);
  return {
    total,
    parts: KINDS.map((kind) => ({ ...kind, value: counts[kind.key], share: ratio(counts[kind.key], total) })),
  };
}

export function change(cur, prev) {
  if (prev == null) return { dir: "na" };
  if (cur === prev) return { dir: "flat", abs: 0, pct: 0 };
  return { dir: cur > prev ? "up" : "down", abs: cur - prev, pct: prev ? (cur - prev) / prev : null };
}

// Fraction of the day gone in the given time zone at `at`; null if the zone is unknown.
export function dayFraction(timeZone, at) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const pick = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return (pick("hour") * 60 + pick("minute")) / 1440;
  } catch {
    return null;
  }
}

// Round chart maximum with 3-5 integer gridlines.
export function niceScale(max, target = 4) {
  if (max <= 0) return { max: 1, ticks: [0] };
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].find((s) => s * mag >= raw) * mag);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { max: top, ticks };
}

/* ---------- formatting ---------- */

export const fmt = (n) => Number(n).toLocaleString();

export const fmtDec = (n, digits = 1) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });

export function fmtPct(r) {
  if (r == null) return "—";
  const p = r * 100;
  if (p === 0 || Math.abs(p) >= 10) return `${Math.round(p)}%`;
  return `${p.toFixed(1)}%`;
}

export const signed = (n, format = fmt) => (n > 0 ? `+${format(n)}` : n < 0 ? `−${format(-n)}` : "±0");

// Series days arrive as "YYYY-MM-DD" in the admin's time zone; build the date locally so the
// weekday doesn't slide back across UTC midnight.
export function parseDay(isoDay) {
  const [y, m, d] = String(isoDay).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const fmtDay = (isoDay, options = { month: "short", day: "numeric" }) =>
  parseDay(isoDay).toLocaleDateString(undefined, options);

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
