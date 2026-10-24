"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FxName = "correct" | "wrong" | "win" | "tick";

const STORAGE_KEY = "toe-muted";

interface ToneSpec {
  freq: number;
  startOffset: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
}

/**
 * Tiny Web Audio synth — no external sound files needed. Each effect is a
 * short sequence of oscillator tones, so the whole asset footprint is zero.
 */
class FxEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) throw new Error("Web Audio is not supported");
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone({ freq, startOffset, duration, type = "sine", volume = 0.12 }: ToneSpec) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + startOffset;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  play(name: FxName) {
    switch (name) {
      case "correct":
        this.tone({ freq: 523.25, startOffset: 0, duration: 0.12 });
        this.tone({ freq: 659.25, startOffset: 0.1, duration: 0.18 });
        break;
      case "wrong":
        this.tone({ freq: 220, startOffset: 0, duration: 0.25, type: "sawtooth", volume: 0.08 });
        this.tone({ freq: 174.61, startOffset: 0.12, duration: 0.3, type: "sawtooth", volume: 0.08 });
        break;
      case "win":
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
          this.tone({ freq, startOffset: i * 0.14, duration: 0.22 }),
        );
        break;
      case "tick":
        this.tone({ freq: 880, startOffset: 0, duration: 0.06, volume: 0.06 });
        break;
    }
  }
}

export interface UseSoundFxResult {
  play: (name: FxName) => void;
  muted: boolean;
  toggleMute: () => void;
}

export function useSoundFx(): UseSoundFxResult {
  const engineRef = useRef<FxEngine | null>(null);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);

  // Initialise lazily on the client; SSR renders default to unmuted.
  useEffect(() => {
    const isMuted = window.localStorage.getItem(STORAGE_KEY) === "1";
    mutedRef.current = isMuted;
    setMuted(isMuted);
  }, []);

  const play = useCallback((name: FxName) => {
    if (mutedRef.current) return;
    try {
      engineRef.current ??= new FxEngine();
      engineRef.current.play(name);
    } catch {
      // Audio unavailable (older browser / blocked autoplay) — fail silently.
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { play, muted, toggleMute };
}
