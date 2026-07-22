import { describe, expect, it } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isRoomCode,
  normalizeRoomCode,
} from "./roomCode";

describe("room codes", () => {
  it("generates six-character codes from the unambiguous alphabet", () => {
    for (let index = 0; index < 50; index += 1) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect([...code].every((character) => ROOM_CODE_ALPHABET.includes(character))).toBe(true);
    }
  });

  it("normalizes and validates the existing race input format", () => {
    expect(normalizeRoomCode(" ab2xyz ")).toBe("AB2XYZ");
    expect(isRoomCode(" ab2xyz ")).toBe(true);
    expect(isRoomCode("ABC-23")).toBe(false);
    expect(isRoomCode("ABC1234")).toBe(false);
    expect(isRoomCode("ABC1Z9")).toBe(false);
  });
});
