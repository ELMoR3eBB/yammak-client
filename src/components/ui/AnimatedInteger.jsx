import React, { useEffect, useRef, useState } from "react";

/**
 * Counts from the last settled value to `value` over `duration` ms (ease-out cubic).
 * - `entranceFromZero`: first segment starts at 0 (use after skeleton + `key` remount per fetch).
 * - `rerunFromZeroKey`: when this value changes after mount, reset to 0 and count up again.
 */
export default function AnimatedInteger({
  value,
  duration = 650,
  className = "",
  rerunFromZeroKey,
  entranceFromZero = false,
}) {
  const target = Math.max(0, Math.round(Number(value) || 0));
  const [display, setDisplay] = useState(() => (entranceFromZero ? 0 : target));
  const settledRef = useRef(entranceFromZero ? 0 : null);
  const rafRef = useRef(0);
  const lastRerunRef = useRef(undefined);

  useEffect(() => {
    if (rerunFromZeroKey === undefined) return;
    if (lastRerunRef.current === undefined) {
      lastRerunRef.current = rerunFromZeroKey;
      return;
    }
    if (lastRerunRef.current === rerunFromZeroKey) return;
    lastRerunRef.current = rerunFromZeroKey;
    cancelAnimationFrame(rafRef.current);
    settledRef.current = 0;
    setDisplay(0);
  }, [rerunFromZeroKey]);

  useEffect(() => {
    if (settledRef.current === null) {
      settledRef.current = target;
      setDisplay(target);
      return;
    }
    const from = settledRef.current;
    if (from === target) return;

    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        settledRef.current = target;
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, rerunFromZeroKey]);

  return <span className={`tabular-nums ${className}`.trim()}>{display}</span>;
}
