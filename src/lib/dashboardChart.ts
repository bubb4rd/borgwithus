import { getRecentRolls } from "./userData";

export type DayBucket = {
  label: string;
  count: number;
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function getWeeklyRollBuckets(): DayBucket[] {
  const rolls = getRecentRolls();
  const buckets: DayBucket[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);

    const next = new Date(date);
    next.setDate(next.getDate() + 1);

    const count = rolls.filter((roll) => {
      const rolled = new Date(roll.rolledAt);
      return rolled >= date && rolled < next;
    }).length;

    buckets.push({
      label: DAY_LABELS[date.getDay()],
      count,
    });
  }

  return buckets;
}

export function getWeeklyRollTotal() {
  return getWeeklyRollBuckets().reduce((sum, day) => sum + day.count, 0);
}

export function maxBucketCount(buckets: DayBucket[]) {
  return Math.max(1, ...buckets.map((b) => b.count));
}
