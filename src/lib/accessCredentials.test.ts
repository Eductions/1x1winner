import { describe, expect, it } from "vitest";
import {
  canonicalPlayerName,
  generateAccessCode,
  internalEmailForName,
  normalizeLoginName,
  validateAccessCode,
  validatePlayerName,
} from "./accessCredentials";

describe("player-name normalisation", () => {
  it("trims and collapses spacing while preserving the display spelling", () => {
    expect(canonicalPlayerName("  Sara   Ali  ")).toBe("Sara Ali");
    expect(canonicalPlayerName("  سارة   علي  ")).toBe("سارة علي");
  });

  it("makes Latin login names case-insensitive", () => {
    expect(normalizeLoginName("  SaRa   ALI ")).toBe("sara ali");
  });

  it("accepts Arabic and Latin player names", () => {
    expect(validatePlayerName("سارة علي")).toBeNull();
    expect(validatePlayerName("Sara Ali")).toBeNull();
    expect(validatePlayerName("Player 01")).toBeNull();
  });

  it("rejects short, overlong and email-like names", () => {
    expect(validatePlayerName("Al")).not.toBeNull();
    expect(validatePlayerName("A".repeat(31))).not.toBeNull();
    expect(validatePlayerName("sara@example.com")).not.toBeNull();
    expect(validatePlayerName("Sara/Ali")).not.toBeNull();
  });
});

describe("access-code validation", () => {
  it("requires at least six characters for students", () => {
    expect(validateAccessCode("12345")).not.toBeNull();
    expect(validateAccessCode("123456")).toBeNull();
    expect(validateAccessCode("Tower 2026")).not.toBeNull();
  });

  it("requires at least eight characters for the supervisor", () => {
    expect(validateAccessCode("123456", { supervisor: true })).not.toBeNull();
    expect(validateAccessCode("12345678", { supervisor: true })).toBeNull();
  });
});

describe("internal login identifier", () => {
  it("is deterministic across case and spacing differences", async () => {
    await expect(internalEmailForName(" Sara   Ali ")).resolves.toBe(
      await internalEmailForName("sara ali"),
    );
  });

  it("differs between names and does not expose the typed name", async () => {
    const first = await internalEmailForName("Sara Ali");
    const second = await internalEmailForName("Omar Ali");

    expect(first).not.toBe(second);
    expect(first).toMatch(/^p-[a-f0-9]{40}@login\.1x1winner\.local$/);
    expect(first.toLowerCase()).not.toContain("sara");
  });

  it("supports Arabic names", async () => {
    await expect(internalEmailForName("سارة علي")).resolves.toMatch(
      /^p-[a-f0-9]{40}@login\.1x1winner\.local$/,
    );
  });
});

describe("generateAccessCode", () => {
  it("creates an unambiguous code of the requested length", () => {
    const code = generateAccessCode(10);

    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
