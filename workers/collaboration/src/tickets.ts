import {
  RELAY_LIMITS,
  ROOM_CODE_PATTERN,
  ROOM_INSTANCE_PATTERN,
  type RelayChannel,
  type RelayTicketPayload,
} from "./protocol";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  if (encoder.encode(secret).byteLength < 32) {
    throw new Error("RELAY_TICKET_SECRET must contain at least 32 UTF-8 bytes");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function createNonce(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function signRelayTicket(payload: RelayTicketPayload, secret: string): Promise<string> {
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signedValue = `v1.${encodedPayload}`;
  const signature = await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(signedValue));
  return `${signedValue}.${toBase64Url(new Uint8Array(signature))}`;
}

function isTicketPayload(value: unknown): value is RelayTicketPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Partial<RelayTicketPayload>;
  return (
    payload.version === 1 &&
    typeof payload.roomInstanceId === "string" &&
    ROOM_INSTANCE_PATTERN.test(payload.roomInstanceId) &&
    typeof payload.code === "string" &&
    ROOM_CODE_PATTERN.test(payload.code) &&
    typeof payload.uid === "string" &&
    payload.uid.length > 0 &&
    payload.uid.length <= 128 &&
    typeof payload.nickname === "string" &&
    payload.nickname.length > 0 &&
    payload.nickname.length <= 40 &&
    (payload.role === "creator" || payload.role === "member") &&
    (payload.channel === "sync" || payload.channel === "control") &&
    typeof payload.issuedAt === "number" &&
    Number.isSafeInteger(payload.issuedAt) &&
    typeof payload.expiresAt === "number" &&
    Number.isSafeInteger(payload.expiresAt) &&
    typeof payload.nonce === "string" &&
    payload.nonce.length >= 16 &&
    payload.nonce.length <= 64
  );
}

export interface TicketVerificationOptions {
  expectedRoomInstanceId?: string;
  expectedChannel?: RelayChannel;
  now?: number;
}

export async function verifyRelayTicket(
  ticket: string,
  secret: string,
  options: TicketVerificationOptions = {},
): Promise<RelayTicketPayload | null> {
  const parts = ticket.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;

  const payloadBytes = fromBase64Url(parts[1]);
  const signature = fromBase64Url(parts[2]);
  if (!payloadBytes || !signature) return null;

  const signedValue = `v1.${parts[1]}`;
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    await importKey(secret),
    signature as unknown as BufferSource,
    encoder.encode(signedValue),
  );
  if (!validSignature) return null;

  let value: unknown;
  try {
    value = JSON.parse(decoder.decode(payloadBytes));
  } catch {
    return null;
  }
  if (!isTicketPayload(value)) return null;

  const now = options.now ?? Date.now();
  if (value.issuedAt > now + 5_000 || value.expiresAt <= now) return null;
  if (value.expiresAt - value.issuedAt > RELAY_LIMITS.ticketLifetimeMs) return null;
  if (options.expectedRoomInstanceId && value.roomInstanceId !== options.expectedRoomInstanceId) return null;
  if (options.expectedChannel && value.channel !== options.expectedChannel) return null;
  return value;
}

export function decodeUntrustedFirebaseUid(idToken: string): string | null {
  if (!isPlausibleFirebaseIdToken(idToken)) return null;
  const parts = idToken.split(".");
  const payloadBytes = fromBase64Url(parts[1]);
  if (!payloadBytes) return null;
  try {
    const payload = JSON.parse(decoder.decode(payloadBytes)) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 && payload.sub.length <= 128
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

/**
 * Performs only cheap structural checks. Authenticity is established by the
 * subsequent exact Firebase REST read, which sends the token to Firebase.
 */
export function isPlausibleFirebaseIdToken(idToken: string): boolean {
  if (idToken.length < 16 || idToken.length > 8_192) return false;
  const parts = idToken.split(".");
  return (
    parts.length === 3 &&
    parts.every((part) => part.length > 0 && part.length <= 6_144 && /^[A-Za-z0-9_-]+$/.test(part))
  );
}
