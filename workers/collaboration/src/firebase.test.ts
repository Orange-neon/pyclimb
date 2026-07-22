import { describe, expect, it, vi } from "vitest";

import { MembershipError, verifyFirebaseRoomMembership } from "./firebase";

function fakeFirebaseToken(uid: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: uid })}.signature`;
}

describe("Firebase room membership validation", () => {
  it("reads only the caller's member and room meta paths with the ID token", async () => {
    const token = fakeFirebaseToken("user/with slash");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uid: "user/with slash",
        nickname: " Ada ",
        slot: "29",
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        creatorUid: "user/with slash",
        roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
        status: "open",
        leaseExpiresAt: 20_000,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify("user/with slash")));

    await expect(
      verifyFirebaseRoomMembership(
        "https://sample-default-rtdb.firebaseio.com/",
        "ABC234",
        "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
        token,
        fetcher,
        10_000,
      ),
    ).resolves.toEqual({ uid: "user/with slash", nickname: "Ada", slot: "29", role: "creator" });

    const urls = fetcher.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toContain("/collaborationRooms/ABC234/members/user%2Fwith%20slash.json");
    expect(urls[1]).toContain("/collaborationRooms/ABC234/meta.json");
    expect(urls[2]).toContain("/collaborationRooms/ABC234/memberSlots/29.json");
    expect(new URL(urls[0]).searchParams.get("auth")).toBe(token);
    expect(new URL(urls[2]).searchParams.get("auth")).toBe(token);
  });

  it("rejects an instance mismatch and Firebase authorization failures", async () => {
    const token = fakeFirebaseToken("user-a");
    const mismatchFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ uid: "user-a", nickname: "Ada", slot: "0" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        creatorUid: "user-a",
        roomInstanceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "open",
        leaseExpiresAt: 20_000,
      })));
    await expect(
      verifyFirebaseRoomMembership(
        "https://sample-default-rtdb.firebaseio.com",
        "ABC234",
        "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
        token,
        mismatchFetcher,
        10_000,
      ),
    ).rejects.toMatchObject({ status: 404, code: "room-expired" });

    const deniedFetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("denied", { status: 403 }));
    await expect(
      verifyFirebaseRoomMembership(
        "https://sample-default-rtdb.firebaseio.com",
        "ABC234",
        "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
        token,
        deniedFetcher,
      ),
    ).rejects.toBeInstanceOf(MembershipError);
  });

  it("rejects missing, invalid, and expired room leases", async () => {
    const token = fakeFirebaseToken("user-a");
    for (const leaseExpiresAt of [undefined, Number.NaN, 10_000]) {
      const fetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(JSON.stringify({ uid: "user-a", nickname: "Ada", slot: "0" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          creatorUid: "user-a",
          roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
          status: "open",
          ...(leaseExpiresAt === undefined ? {} : { leaseExpiresAt }),
        })));

      await expect(
        verifyFirebaseRoomMembership(
          "https://sample-default-rtdb.firebaseio.com",
          "ABC234",
          "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
          token,
          fetcher,
          10_000,
        ),
      ).rejects.toMatchObject({ status: 404, code: "room-expired" });
    }
  });

  it("rejects missing and out-of-range member slot claims before reading a slot", async () => {
    const token = fakeFirebaseToken("user-a");
    for (const slot of [undefined, "-1", "30", "01", 4]) {
      const fetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          uid: "user-a",
          nickname: "Ada",
          ...(slot === undefined ? {} : { slot }),
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          creatorUid: "user-a",
          roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
          status: "open",
          leaseExpiresAt: 20_000,
        })));

      await expect(
        verifyFirebaseRoomMembership(
          "https://sample-default-rtdb.firebaseio.com",
          "ABC234",
          "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
          token,
          fetcher,
          10_000,
        ),
      ).rejects.toMatchObject({ status: 403, code: "invalid-member" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("rejects a missing or wrong exact slot assignment", async () => {
    const token = fakeFirebaseToken("user-a");
    for (const assignedUid of [null, "user-b"]) {
      const fetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(JSON.stringify({ uid: "user-a", nickname: "Ada", slot: "7" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          creatorUid: "user-a",
          roomInstanceId: "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
          status: "open",
          leaseExpiresAt: 20_000,
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify(assignedUid)));

      await expect(
        verifyFirebaseRoomMembership(
          "https://sample-default-rtdb.firebaseio.com",
          "ABC234",
          "13c5ba32-bb06-49ea-a5dc-9cd40fa9aa58",
          token,
          fetcher,
          10_000,
        ),
      ).rejects.toMatchObject({ status: 403, code: "invalid-member" });
      expect(String(fetcher.mock.calls[2][0])).toContain(
        "/collaborationRooms/ABC234/memberSlots/7.json",
      );
    }
  });
});
