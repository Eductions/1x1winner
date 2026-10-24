import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSoundFx } from "./useSoundFx";

interface AudioParamMock {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
}

interface FakeNode {
  kind: string;
  type: string;
  frequency: AudioParamMock;
  gain: AudioParamMock;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function makeAudioParam(): AudioParamMock {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function installAudioContextMock() {
  const created: FakeNode[] = [];

  const makeNode = (kind: "oscillator" | "gain"): FakeNode => {
    const node: FakeNode = {
      kind,
      type: "sine",
      frequency: makeAudioParam(),
      gain: makeAudioParam(),
      connect: vi.fn(() => node),
      start: vi.fn(),
      stop: vi.fn(),
    };
    created.push(node);
    return node;
  };

  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => makeNode("oscillator")),
    createGain: vi.fn(() => makeNode("gain")),
  };

  vi.stubGlobal("AudioContext", vi.fn(() => ctx));
  return { ctx, created };
}

describe("useSoundFx", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays a two-tone correct effect", () => {
    const audio = installAudioContextMock();
    const { result } = renderHook(() => useSoundFx());

    act(() => result.current.play("correct"));

    expect(audio.ctx.createOscillator).toHaveBeenCalledTimes(2);
    expect(audio.ctx.createGain).toHaveBeenCalledTimes(2);
  });

  it("plays a four-note victory arpeggio", () => {
    const audio = installAudioContextMock();
    const { result } = renderHook(() => useSoundFx());

    act(() => result.current.play("win"));
    expect(audio.ctx.createOscillator).toHaveBeenCalledTimes(4);
  });

  it("stays silent while muted and remembers the preference", () => {
    const audio = installAudioContextMock();
    const { result } = renderHook(() => useSoundFx());

    act(() => result.current.toggleMute());
    expect(result.current.muted).toBe(true);
    expect(window.localStorage.getItem("toe-muted")).toBe("1");

    act(() => result.current.play("wrong"));
    expect(audio.ctx.createOscillator).not.toHaveBeenCalled();

    act(() => result.current.toggleMute());
    act(() => result.current.play("tick"));
    expect(audio.ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("does not throw when Web Audio is unavailable", () => {
    // No AudioContext stub at all.
    vi.stubGlobal("AudioContext", undefined);
    const { result } = renderHook(() => useSoundFx());
    expect(() => act(() => result.current.play("correct"))).not.toThrow();
  });
});
