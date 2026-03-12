import { useState, useRef, useEffect } from "react";

/**
 * Animates a number from current (or 0 when key changes) to the target value with easing.
 * @param {number} value - Target value
 * @param {string} key - Stable key; when it changes, animation starts from 0
 * @param {number} duration - Duration in ms (default 800)
 * @returns {number} Current displayed value (use with toLocaleString() etc.)
 */
export function useAnimatedNumber(value, key, duration = 800) {
  const [display, setDisplay] = useState(0);
  const prevKeyRef = useRef(key);
  const displayRef = useRef(0);
  const rafRef = useRef(null);
  displayRef.current = display;

  useEffect(() => {
    const num = Number(value);
    const target = Number.isNaN(num) ? 0 : num;
    const keyChanged = prevKeyRef.current !== key;
    prevKeyRef.current = key;
    const startVal = keyChanged ? 0 : displayRef.current;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 2);
      const current = Math.round(startVal + (target - startVal) * ease);
      setDisplay(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, key, duration]);

  return display;
}
