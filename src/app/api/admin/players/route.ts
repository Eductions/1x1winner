import { NextResponse, type NextRequest } from "next/server";
import {
  createManagedAccount,
  listStudentAccounts,
  PlayerAccountError,
  requireSupervisor,
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
    { error: "Player account request failed.", code: "PLAYER_REQUEST_FAILED" },
    { status: 500 },
  );
}

function stringField(body: unknown, key: string): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export async function GET() {
  try {
    const { admin } = await requireSupervisor();
    const players = await listStudentAccounts(admin);
    return NextResponse.json({ players });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireSupervisor();
    const body: unknown = await request.json().catch(() => null);

    // The role is deliberately not accepted from the browser: this endpoint
    // can only create student/player accounts.
    const player = await createManagedAccount(admin, {
      name: stringField(body, "name"),
      code: stringField(body, "code"),
      role: "student",
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
