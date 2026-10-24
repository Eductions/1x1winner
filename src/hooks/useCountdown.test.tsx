import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("holds the full duration while paused", () => {
    const { result } = renderHook(() => useCountdown(20, false));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.remaining).toBe(20);
  });

  it("ticks down each second while running", () => {
    const { result } = renderHook(() => useCountdown(20, true));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.remaining).toBe(17);
  });

  it("fires onExpire exactly once at zero", () => {
    const onExpire = vi.fn();
    renderHook(() => useCountdown(5, true, onExpire));

    act(() => vi.advanceTimersByTime(5000));
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Extra ticks must not re-fire the callback.
    act(() => vi.advanceTimersByTime(4000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("restarts the clock when the reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useCountdown(20, true, undefined, resetKey),
      { initialProps: { resetKey: "q-1" } },
    );

    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.remaining).toBe(16);

    rerender({ resetKey: "q-2" });
    expect(result.current.remaining).toBe(20);
  });

  it("reset() rewinds the timer manually", () => {
    const { result } = renderHook(() => useCountdown(10, true));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.reset());
    expect(result.current.remaining).toBe(10);
  });
});
