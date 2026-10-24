import { afterEach, describe, expect, it } from "vitest";
import { isSupabaseConfigured } from "./env";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("isSupabaseConfigured", () => {
  it("is false when either variable is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isSupabaseConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is true when both public variables are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(isSupabaseConfigured()).toBe(true);
  });
});
