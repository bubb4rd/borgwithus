type StarRatingProps = {
  value?: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md" | "lg";
};

export default function StarRating({
  value = 0,
  onChange,
  size = "md",
}: StarRatingProps) {
  const starSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Rate name">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(star)}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            className={`transition-colors ${
              onChange ? "cursor-pointer hover:scale-110" : "cursor-default"
            } ${filled ? "text-hazard" : "text-border"}`}
          >
            <svg
              width={starSize}
              height={starSize}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
