import { describe, expect, it } from "vitest";
import {
  friendlyErrorMessage,
  isValidRoomCode,
  normalizeRoomCode,
} from "./forms";

describe("room code helpers", () => {
  it("normalises to uppercase alphanumerics and caps at 6 characters", () => {
    expect(normalizeRoomCode("ab-12 cd!")).toBe("AB12CD");
    expect(normalizeRoomCode("XYZ999EXTRA")).toBe("XYZ999");
    expect(normalizeRoomCode("")).toBe("");
  });

  it("accepts exactly six valid characters", () => {
    expect(isValidRoomCode("ABC123")).toBe(true);
    expect(isValidRoomCode("ZZZZ99")).toBe(true);
  });

  it("rejects short codes and the confusing I/O letters", () => {
    expect(isValidRoomCode("ABC12")).toBe(false);
    expect(isValidRoomCode("IO1234")).toBe(false);
    expect(isValidRoomCode("ABC1234")).toBe(false);
  });
});

describe("friendlyErrorMessage", () => {
  it("maps RPC codes to friendly copy", () => {
    expect(friendlyErrorMessage("ROOM_NOT_FOUND")).toBe("No room exists with this code.");
    expect(friendlyErrorMessage("ROOM_FULL")).toBe("This room already has two teams.");
    expect(friendlyErrorMessage("NOT_YOUR_TURN")).toBe("It is the other team's turn.");
    expect(friendlyErrorMessage("SUPERVISOR_ONLY")).toBe(
      "Only the supervisor can manage player accounts.",
    );
  });

  it("maps raw Supabase auth errors to name-and-code copy", () => {
    expect(friendlyErrorMessage("Invalid login credentials")).toBe(
      "Incorrect name or access code.",
    );
    expect(friendlyErrorMessage("User already registered")).toBe(
      "A player with this name already exists.",
    );
    expect(friendlyErrorMessage("some unmapped failure")).toBe("some unmapped failure");
  });
});
