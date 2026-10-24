import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createManagedAccount,
  ensureSupervisorSetupOpen,
  PlayerAccountError,
} from "@/lib/server/playerAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof PlayerAccountError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: "Supervisor setup failed.", code: "SETUP_FAILED" },
    { status: 500 },
  );
}

function stringField(body: unknown, key: string): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function secretsMatch(input: string, expected: string): boolean {
  const inputHash = createHash("sha256").update(input.trim()).digest();
  const expectedHash = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(inputHash, expectedHash);
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.SUPERVISOR_SETUP_SECRET?.trim() ?? "";
    if (expectedSecret.length < 16) {
      throw new PlayerAccountError(503, "SETUP_NOT_CONFIGURED");
    }

    const body: unknown = await request.json().catch(() => null);
    const setupSecret = stringField(body, "setupSecret");
    if (!secretsMatch(setupSecret, expectedSecret)) {
      throw new PlayerAccountError(403, "INVALID_SETUP_SECRET");
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      throw new PlayerAccountError(503, "SETUP_NOT_CONFIGURED");
    }

    await ensureSupervisorSetupOpen(admin);
    await createManagedAccount(admin, {
      name: stringField(body, "name"),
      code: stringField(body, "code"),
      role: "teacher",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
