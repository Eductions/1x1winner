import { describe, expect, it } from "vitest";
import {
  friendlyErrorMessage,
  isValidRoomCode,
  normalizeRoomCode,
  validateEmail,
  validatePassword,
  validateUsername,
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

describe("credential validation", () => {
  it("validates email format", () => {
    expect(validateEmail("student@u.edu.ly")).toBeNull();
    expect(validateEmail("not-an-email")).not.toBeNull();
    expect(validateEmail("  ")).not.toBeNull();
  });

  it("requires an 8-character password", () => {
    expect(validatePassword("short1")).not.toBeNull();
    expect(validatePassword("longenough123")).toBeNull();
  });

  it("validates username length and allowed characters", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("good_name.1-")).toBeNull();
    expect(validateUsername("bad name!")).not.toBeNull();
  });
});

describe("friendlyErrorMessage", () => {
  it("maps RPC codes to friendly copy", () => {
    expect(friendlyErrorMessage("ROOM_NOT_FOUND")).toBe("No room exists with this code.");
    expect(friendlyErrorMessage("ROOM_FULL")).toBe("This room already has two teams.");
    expect(friendlyErrorMessage("NOT_YOUR_TURN")).toBe("It is the other team's turn.");
  });

  it("maps raw Supabase auth errors and falls back to the original message", () => {
    expect(friendlyErrorMessage("Invalid login credentials")).toBe(
      "Incorrect email or password.",
    );
    expect(friendlyErrorMessage("some unmapped failure")).toBe("some unmapped failure");
  });
});
