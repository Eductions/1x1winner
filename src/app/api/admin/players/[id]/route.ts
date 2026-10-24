import { NextResponse, type NextRequest } from "next/server";
import {
  PlayerAccountError,
  requireSupervisor,
  resetStudentAccessCode,
  setStudentDisabled,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { admin } = await requireSupervisor();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const record =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const action = typeof record.action === "string" ? record.action : "";

    if (action === "reset_code") {
      await resetStudentAccessCode(
        admin,
        id,
        typeof record.code === "string" ? record.code : "",
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "set_disabled") {
      await setStudentDisabled(admin, id, record.disabled === true);
      return NextResponse.json({ ok: true });
    }

    throw new PlayerAccountError(
      400,
      "INVALID_PLAYER_ACTION",
      "Choose a valid player action.",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
