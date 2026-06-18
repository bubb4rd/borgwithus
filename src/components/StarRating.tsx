type StarRatingProps = {
  value?: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg" | "xl";
};

function StarIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function StarRating({
  value = 0,
  onChange,
  size = "md",
}: StarRatingProps) {
  const starSize =
    size === "sm" ? 14 : size === "lg" ? 22 : size === "xl" ? 28 : 18;
  const starGap =
    size === "xl" ? "gap-1.5" : size === "lg" ? "gap-1" : "gap-0.5";
  const readOnly = !onChange;

  return (
    <div
      className={`flex shrink-0 items-center leading-none ${starGap}`}
      role="group"
      aria-label={readOnly ? `Average rating ${value.toFixed(1)} out of 5` : "Rate name"}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = readOnly
          ? Math.min(1, Math.max(0, value - (star - 1)))
          : star <= value
            ? 1
            : 0;

        if (!readOnly) {
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              className={`cursor-pointer transition-colors hover:scale-110 ${
                fill ? "text-hazard" : "text-border"
              }`}
            >
              <StarIcon size={starSize} />
            </button>
          );
        }

        return (
          <span key={star} className="relative inline-flex shrink-0">
            <span className="text-border">
              <StarIcon size={starSize} />
            </span>
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden text-hazard"
                style={{ width: `${fill * 100}%` }}
              >
                <StarIcon size={starSize} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
