import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

const HINT_FADE_MS = 500;
const HINT_GAP_MS = 400;

type ScrollHint = "none" | "down" | "up";

type ScrollHintListProps = {
  children: ReactNode;
  showHint?: boolean;
  height?: number;
  className?: string;
  refreshDeps?: unknown[];
};

export default function ScrollHintList({
  children,
  showHint = true,
  height,
  className = "",
  refreshDeps = [],
}: ScrollHintListProps) {
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTargetRef = useRef<ScrollHint>("none");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [targetHint, setTargetHint] = useState<ScrollHint>("none");
  const [shownHint, setShownHint] = useState<ScrollHint>("none");
  const [hintVisible, setHintVisible] = useState(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const queueTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }, []);

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;

    if (!hasOverflow) {
      setTargetHint("none");
    } else if (atBottom) {
      setTargetHint("up");
    } else {
      setTargetHint("down");
    }
  }, []);

  useEffect(() => {
    clearTimers();

    if (reducedMotion) {
      setShownHint(targetHint);
      setHintVisible(targetHint !== "none");
      prevTargetRef.current = targetHint;
      return;
    }

    const prev = prevTargetRef.current;
    prevTargetRef.current = targetHint;

    if (targetHint === "none") {
      setHintVisible(false);
      queueTimer(() => setShownHint("none"), HINT_FADE_MS);
      return clearTimers;
    }

    if (prev === "none" || prev === targetHint) {
      setShownHint(targetHint);
      queueTimer(() => setHintVisible(true), 80);
      return clearTimers;
    }

    setHintVisible(false);
    queueTimer(() => {
      setShownHint(targetHint);
      queueTimer(() => setHintVisible(true), HINT_GAP_MS);
    }, HINT_FADE_MS);

    return clearTimers;
  }, [targetHint, reducedMotion, clearTimers, queueTimer]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    updateScrollHint();
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateScrollHint, ...refreshDeps]);

  return (
    <div
      className={`relative h-[-webkit-fill-available] overflow-hidden ${
        height ? "" : "min-h-0 flex-1"
      } ${className}`}
    >
      <div
        ref={scrollRef}
        onScroll={updateScrollHint}
        className={`overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          height ? "" : "h-full h-[-webkit-fill-available]"
        }`}
        style={height ? { height } : undefined}
      >
        {children}
      </div>

      {showHint && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-card via-card/90 to-transparent pb-2 pt-10 transition-opacity duration-500 ease-in-out motion-reduce:duration-0 ${
            hintVisible && shownHint !== "none" ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!hintVisible || shownHint === "none"}
        >
          {shownHint !== "none" && (
            <span
              className={`text-subtle/70 transition-transform duration-500 ease-in-out motion-reduce:duration-0 ${
                shownHint === "up" ? "scroll-up-hint" : "scroll-down-hint"
              }`}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-500 ease-in-out motion-reduce:duration-0 ${
                  shownHint === "up" ? "rotate-180" : "rotate-0"
                }`}
              >
                <path d="M12 5v14" />
                <path d="m19 12-7 7-7-7" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
