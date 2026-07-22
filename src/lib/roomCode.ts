export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ROOM_CODE_PATTERN = /^[A-Z2-9]{6}$/;

export function generateRoomCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(ROOM_CODE_LENGTH));
  return Array.from(
    values,
    (value) => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length],
  ).join("");
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Accept the same six-character input range as the existing race join flow.
 * Generated codes use the narrower alphabet above to avoid ambiguous letters.
 */
export function isRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(normalizeRoomCode(value));
}
