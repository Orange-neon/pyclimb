import { describe, expect, it } from "vitest";

import type { RelayTicketPayload } from "./protocol";
import {
  decodeUntrustedFirebaseUid,
  isPlausibleFirebaseIdToken,
  signRelayTicket,
  verifyRelayTicket,
} from "./tickets";

const secret = "test-only-secret-that-is-longer-than-thirty-two-bytes";

function payload(overrides: Partial<RelayTicketPayload> = {}): RelayTicketPayload {
  return {
    version: 1,
    roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
    code: "ABC234",
    uid: "firebase-user",
    nickname: "Ada",
    role: "member",
    channel: "sync",
    issuedAt: 1_000,
    expiresAt: 61_000,
    nonce: "abcdefghijklmnop",
    ...overrides,
  };
}

function fakeFirebaseToken(uid: string): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: uid })}.signature`;
}

describe("relay tickets", () => {
  it("round-trips a valid, room-bound ticket", async () => {
    const signed = await signRelayTicket(payload(), secret);
    await expect(
      verifyRelayTicket(signed, secret, {
        expectedRoomInstanceId: payload().roomInstanceId,
        expectedChannel: "sync",
        now: 30_000,
      }),
    ).resolves.toMatchObject({ uid: "firebase-user", channel: "sync" });
  });

  it("rejects tampering, expiry, wrong rooms, and wrong channels", async () => {
    const signed = await signRelayTicket(payload(), secret);
    await expect(verifyRelayTicket(`${signed}x`, secret, { now: 30_000 })).resolves.toBeNull();
    await expect(verifyRelayTicket(signed, secret, { now: 61_000 })).resolves.toBeNull();
    await expect(
      verifyRelayTicket(signed, secret, { expectedRoomInstanceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", now: 30_000 }),
    ).resolves.toBeNull();
    await expect(
      verifyRelayTicket(signed, secret, { expectedChannel: "control", now: 30_000 }),
    ).resolves.toBeNull();
  });

  it("rejects weak signing secrets", async () => {
    await expect(signRelayTicket(payload(), "too-short")).rejects.toThrow(/32 UTF-8 bytes/);
  });
});

describe("Firebase token subject decoding", () => {
  it("extracts only a bounded subject for constructing the exact rules path", () => {
    expect(decodeUntrustedFirebaseUid(fakeFirebaseToken("uid-123"))).toBe("uid-123");
    expect(decodeUntrustedFirebaseUid("not-a-token")).toBeNull();
    expect(decodeUntrustedFirebaseUid(fakeFirebaseToken("x".repeat(129)))).toBeNull();
  });

  it("rejects oversized and malformed tokens before any Firebase request", () => {
    expect(isPlausibleFirebaseIdToken(fakeFirebaseToken("uid-123"))).toBe(true);
    expect(isPlausibleFirebaseIdToken(`a.${"b".repeat(8_192)}.c`)).toBe(false);
    expect(isPlausibleFirebaseIdToken("a.invalid payload.c")).toBe(false);
    expect(isPlausibleFirebaseIdToken("a.b.")).toBe(false);
  });
});
