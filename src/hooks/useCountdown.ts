"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseCountdownResult {
  remaining: number;
  reset: () => void;
}

/**
 * Seconds countdown. Starts while `running` is true and fires `onExpire`
 * exactly once when it reaches zero. A new `resetKey` (e.g. the next
 * question id) restarts the clock even when the duration is unchanged.
 */
export function useCountdown(
  duration: number,
  running: boolean,
  onExpire?: () => void,
  resetKey?: string | number | null,
): UseCountdownResult {
  const [remaining, setRemaining] = useState(duration);
  const onExpireRef = useRef(onExpire);
  const firedRef = useRef(false);

  onExpireRef.current = onExpire;

  // Restart whenever a fresh round (new question key) begins.
  useEffect(() => {
    setRemaining(duration);
    firedRef.current = false;
  }, [duration, resetKey]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(
      interval,
    );
  }, [running, duration, resetKey]);

  useEffect(() => {
    if (running && remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpireRef.current?.();
    }
  }, [remaining, running]);

  const reset = useCallback(() => {
    firedRef.current = false;
    setRemaining(duration);
  }, [duration]);

  return { remaining, reset };
}
