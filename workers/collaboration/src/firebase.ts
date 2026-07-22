import { decodeUntrustedFirebaseUid } from "./tickets";

export interface FirebaseRoomMember {
  uid: string;
  nickname: string;
  slot: string;
}

interface FirebaseRoomMeta {
  creatorUid?: unknown;
  roomInstanceId?: unknown;
  status?: unknown;
  leaseExpiresAt?: unknown;
}

export interface VerifiedRoomMembership extends FirebaseRoomMember {
  role: "creator" | "member";
}

export class MembershipError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MembershipError";
  }
}

function isMemberSlot(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]|1[0-9]|2[0-9])$/.test(value);
}

function firebaseUrl(databaseUrl: string, path: string, idToken: string): URL {
  const base = databaseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/${path}.json`);
  url.searchParams.set("auth", idToken);
  return url;
}

async function readFirebaseJson(
  url: URL,
  fetcher: typeof fetch,
): Promise<{ status: number; value: unknown }> {
  let response: Response;
  try {
    response = await fetcher(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new MembershipError(503, "firebase-unavailable", "Room authentication is temporarily unavailable.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new MembershipError(401, "invalid-auth", "Your sign-in has expired. Sign in again.");
  }
  if (!response.ok) {
    throw new MembershipError(503, "firebase-unavailable", "Room authentication is temporarily unavailable.");
  }

  try {
    return { status: response.status, value: await response.json() };
  } catch {
    throw new MembershipError(503, "firebase-unavailable", "Room authentication returned an invalid response.");
  }
}

export async function verifyFirebaseRoomMembership(
  databaseUrl: string,
  code: string,
  roomInstanceId: string,
  idToken: string,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
): Promise<VerifiedRoomMembership> {
  const uid = decodeUntrustedFirebaseUid(idToken);
  if (!uid) throw new MembershipError(401, "invalid-auth", "A valid Firebase ID token is required.");

  const encodedCode = encodeURIComponent(code);
  const encodedUid = encodeURIComponent(uid);
  // Always prove that the token can read its exact member path before spending
  // additional Firebase reads on room metadata or slot authorization.
  const memberResponse = await readFirebaseJson(
    firebaseUrl(databaseUrl, `collaborationRooms/${encodedCode}/members/${encodedUid}`, idToken),
    fetcher,
  );

  const member = memberResponse.value as Partial<FirebaseRoomMember> | null;
  if (!member || member.uid !== uid || typeof member.nickname !== "string") {
    throw new MembershipError(404, "room-expired", "This collaboration room is unavailable or has expired.");
  }
  if (!isMemberSlot(member.slot)) {
    throw new MembershipError(403, "invalid-member", "This room membership has an invalid authorization slot.");
  }
  const nickname = member.nickname.trim().slice(0, 40);
  if (!nickname) throw new MembershipError(403, "invalid-member", "This room membership is invalid.");

  const metaResponse = await readFirebaseJson(
    firebaseUrl(databaseUrl, `collaborationRooms/${encodedCode}/meta`, idToken),
    fetcher,
  );
  const meta = metaResponse.value as FirebaseRoomMeta | null;
  if (
    !meta ||
    meta.status !== "open" ||
    meta.roomInstanceId !== roomInstanceId ||
    typeof meta.leaseExpiresAt !== "number" ||
    !Number.isFinite(meta.leaseExpiresAt) ||
    meta.leaseExpiresAt <= now
  ) {
    throw new MembershipError(404, "room-expired", "This collaboration room is unavailable or has expired.");
  }

  const slotResponse = await readFirebaseJson(
    firebaseUrl(
      databaseUrl,
      `collaborationRooms/${encodedCode}/memberSlots/${member.slot}`,
      idToken,
    ),
    fetcher,
  );
  if (slotResponse.value !== uid) {
    throw new MembershipError(403, "invalid-member", "This room membership slot is no longer assigned to you.");
  }

  return {
    uid,
    nickname,
    slot: member.slot,
    role: meta.creatorUid === uid ? "creator" : "member",
  };
}
