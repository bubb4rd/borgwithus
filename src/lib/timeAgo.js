const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "always", style: "narrow" });
const STEPS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// "3h ago", "2d ago"; anything under a minute is "just now".
export function timeAgo(iso) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
