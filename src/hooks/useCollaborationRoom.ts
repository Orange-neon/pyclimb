import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getFirebaseContext,
  getFirebaseIdToken,
  isFirebaseConfigured,
  observeGoogleUser,
  signInWithGoogle,
  signOutFirebase,
  type GoogleUserProfile,
} from "../lib/firebase";
import { generateRoomCode, isRoomCode, normalizeRoomCode } from "../lib/roomCode";
import {
  clearActiveRoomSession,
  getCollaborationRoomSession,
  readActiveRoomSession,
  subscribeActiveRoomSession,
  writeActiveRoomSession,
} from "../lib/roomSession";
import {
  COLLABORATION_SCHEMA_VERSION,
  MAX_COLLABORATION_MEMBERS,
  type CollaborationMember,
  type CollaborationRoomMeta,
  type CollaborationRoomSession,
} from "../types/collaboration";

const ROOM_LEASE_MS = 90_000;
const ROOM_HEARTBEAT_MS = 30_000;

function generateRoomInstanceId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

type FirebaseContext = Pick<
  Awaited<ReturnType<typeof getFirebaseContext>>,
  "database" | "user" | "db"
>;

function isMemberSlot(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return false;
  const slot = Number(value);
  return slot >= 0 && slot < MAX_COLLABORATION_MEMBERS;
}

function memberSlotCandidates(preferred?: string): string[] {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % MAX_COLLABORATION_MEMBERS;
  const candidates = Array.from(
    { length: MAX_COLLABORATION_MEMBERS },
    (_, index) => String((random + index) % MAX_COLLABORATION_MEMBERS),
  );
  if (isMemberSlot(preferred)) {
    return [preferred, ...candidates.filter((candidate) => candidate !== preferred)];
  }
  return candidates;
}

async function claimCollaborationMembership(
  context: FirebaseContext,
  code: string,
  member: Omit<CollaborationMember, "slot">,
  preferredSlot?: string,
): Promise<CollaborationMember> {
  const { database, user, db } = context;
  const roomRef = db.ref(database, `collaborationRooms/${code}`);

  for (const slot of memberSlotCandidates(preferredSlot)) {
    const claimedMember = { ...member, slot } satisfies CollaborationMember;
    try {
      // Slot and member must pass their cross-validating rules in the same
      // atomic post-write room snapshot.
      await db.update(roomRef, {
        [`memberSlots/${slot}`]: user.uid,
        [`members/${user.uid}`]: claimedMember,
      });
      return claimedMember;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (/permission|denied/i.test(message)) continue;
      throw reason;
    }
  }

  throw new Error(`This room is unavailable or already has ${MAX_COLLABORATION_MEMBERS} members.`);
}

function readSession(): CollaborationRoomSession | null {
  return getCollaborationRoomSession(readActiveRoomSession());
}

function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateNickname(value: string): string {
  const nickname = normalizeNickname(value);
  if (nickname.length < 2 || nickname.length > 20) {
    throw new Error("Nickname must be between 2 and 20 characters.");
  }
  return nickname;
}

function creatorNickname(
  requested: string | undefined,
  user: { displayName: string | null; email: string | null },
): string {
  const preferred = normalizeNickname(
    requested || user.displayName || user.email?.split("@")[0] || "Creator",
  );
  const bounded = preferred.slice(0, 20).trim();
  return bounded.length >= 2 ? bounded : "Creator";
}

function hasGoogleProvider(user: { providerData: Array<{ providerId: string }> }): boolean {
  return user.providerData.some((provider) => provider.providerId === "google.com");
}

export function useCollaborationRoom() {
  const [session, setSessionState] = useState<CollaborationRoomSession | null>(readSession);
  const [authUser, setAuthUser] = useState<GoogleUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [meta, setMeta] = useState<CollaborationRoomMeta | null>(null);
  const [members, setMembers] = useState<CollaborationMember[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);
  const serverOffsetRef = useRef(0);

  const saveSession = useCallback((next: CollaborationRoomSession | null) => {
    setSessionState(next);
    if (next) writeActiveRoomSession(next);
    else clearActiveRoomSession("collaboration");
  }, []);

  useEffect(
    () =>
      subscribeActiveRoomSession((activeSession) => {
        setSessionState(getCollaborationRoomSession(activeSession));
        if (activeSession?.kind === "race") setError(null);
      }),
    [],
  );

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const fallbackId = window.setTimeout(() => {
      if (!cancelled) setAuthLoading(false);
    }, 2_000);
    observeGoogleUser((user) => {
      if (cancelled) return;
      window.clearTimeout(fallbackId);
      setAuthUser(user);
      setAuthLoading(false);
    })
      .then((cleanup) => {
        if (cancelled) cleanup();
        else unsubscribe = cleanup;
      })
      .catch(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackId);
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    const user = await signInWithGoogle();
    setAuthUser(user);
  }, []);

  const signOut = useCallback(async () => {
    saveSession(null);
    await signOutFirebase();
    setAuthUser(null);
  }, [saveSession]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (session) saveSession(null);
      setLoading(false);
      return;
    }
    if (!session) {
      setMeta(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let firebaseConnected = false;
    let cleanups: Array<() => void> = [];
    let unsubscribeMembers: (() => void) | null = null;
    let heartbeatId: number | null = null;
    setLoading(true);
    setError(null);

    getFirebaseContext()
      .then(({ database, user, db }) => {
        if (cancelled) return;
        if (user.uid !== session.uid) {
          saveSession(null);
          throw new Error("This collaboration session belongs to a different browser identity.");
        }

        const metaRef = db.ref(database, `collaborationRooms/${session.code}/meta`);
        const membersRef = db.ref(database, `collaborationRooms/${session.code}/members`);
        const memberRef = db.ref(
          database,
          `collaborationRooms/${session.code}/members/${session.uid}`,
        );
        const connectedRef = db.ref(database, ".info/connected");
        const offsetRef = db.ref(database, ".info/serverTimeOffset");

        const expireSession = (message: string) => {
          if (cancelled) return;
          setError(message);
          setLoading(false);
          saveSession(null);
        };

        const refreshLease = async () => {
          if (!firebaseConnected || cancelled) return;
          await db.update(metaRef, {
            leaseExpiresAt: Date.now() + serverOffsetRef.current + ROOM_LEASE_MS,
          });
        };

        const restoreMembership = async () => {
          const [metaSnapshot, memberSnapshot, offsetSnapshot] = await Promise.all([
            db.get(metaRef),
            db.get(memberRef),
            db.get(offsetRef),
          ]);
          if (cancelled || !metaSnapshot.exists()) return;
          serverOffsetRef.current = Number(offsetSnapshot.val()) || 0;
          const currentMeta = metaSnapshot.val() as CollaborationRoomMeta;
          const serverNow = Date.now() + serverOffsetRef.current;
          if (
            currentMeta.roomInstanceId !== session.roomInstanceId ||
            currentMeta.status !== "open" ||
            !Number.isFinite(currentMeta.leaseExpiresAt) ||
            currentMeta.leaseExpiresAt <= serverNow
          ) {
            expireSession("This collaboration room has expired.");
            return;
          }
          const existingMember = memberSnapshot.exists()
            ? (memberSnapshot.val() as CollaborationMember)
            : null;
          const claimed = await claimCollaborationMembership(
            { database, user, db },
            session.code,
            {
              uid: session.uid,
              nickname: existingMember?.nickname ?? session.nickname,
              joinedAt: existingMember?.joinedAt ?? serverNow,
            },
            isMemberSlot(existingMember?.slot) ? existingMember.slot : session.memberSlot,
          );
          unsubscribeMembers?.();
          unsubscribeMembers = db.onValue(
            membersRef,
            (snapshot) => {
              const value = (snapshot.val() ?? {}) as Record<string, CollaborationMember>;
              setMembers(Object.values(value));
            },
            () => {
              // Relay awareness is presence. Firebase members remain durable
              // authorization records until explicit Leave or room expiry.
            },
          );
          await refreshLease();
          if (
            claimed.slot !== session.memberSlot ||
            claimed.nickname !== session.nickname
          ) {
            saveSession({
              ...session,
              nickname: claimed.nickname,
              memberSlot: claimed.slot,
            });
          }
        };

        cleanups = [
          db.onValue(metaRef, (snapshot) => {
            if (!snapshot.exists()) {
              expireSession("This collaboration room has expired.");
              return;
            }
            const nextMeta = snapshot.val() as CollaborationRoomMeta;
            if (nextMeta.roomInstanceId !== session.roomInstanceId) {
              expireSession("This room code now belongs to a different collaboration room.");
              return;
            }
            if (nextMeta.status !== "open") {
              expireSession("This collaboration room has expired.");
              return;
            }
            setMeta(nextMeta);
            setLoading(false);
          }),
          db.onValue(connectedRef, (snapshot) => {
            firebaseConnected = snapshot.val() === true;
            setConnected(firebaseConnected);
            if (firebaseConnected) {
              void restoreMembership().catch((reason) => {
                if (!cancelled) {
                  setError(reason instanceof Error ? reason.message : String(reason));
                }
              });
            }
          }),
          db.onValue(offsetRef, (snapshot) => {
            serverOffsetRef.current = Number(snapshot.val()) || 0;
          }),
          () => unsubscribeMembers?.(),
        ];
        heartbeatId = window.setInterval(() => {
          void refreshLease().catch(() => undefined);
        }, ROOM_HEARTBEAT_MS);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (heartbeatId !== null) window.clearInterval(heartbeatId);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [saveSession, session]);

  const createRoom = useCallback(
    async (rawNickname?: string): Promise<CollaborationRoomSession> => {
      setError(null);
      const { database, user, db } = await getFirebaseContext();
      if (!hasGoogleProvider(user)) {
        throw new Error("Sign in with Google to create a collaboration room.");
      }
      const nickname = creatorNickname(rawNickname, user);
      const offsetSnapshot = await db.get(db.ref(database, ".info/serverTimeOffset"));
      const serverOffset = Number(offsetSnapshot.val()) || 0;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = generateRoomCode();
        const roomInstanceId = generateRoomInstanceId();
        const createdAt = Date.now() + serverOffset;
        const roomRef = db.ref(database, `collaborationRooms/${code}`);
        try {
          // A blind set is intentional: RTDB transactions require room-level
          // read access, which would expose member records to any Google user.
          // The rules atomically reject live-code collisions and allow expired
          // code-only records to be replaced.
          await db.set(roomRef, {
            meta: {
              creatorUid: user.uid,
              roomInstanceId,
              schemaVersion: COLLABORATION_SCHEMA_VERSION,
              status: "open",
              createdAt,
              leaseExpiresAt: createdAt + ROOM_LEASE_MS,
            },
            members: {
              [user.uid]: { uid: user.uid, nickname, joinedAt: createdAt, slot: "0" },
            },
            memberSlots: { "0": user.uid },
          });
          const next: CollaborationRoomSession = {
            kind: "collaboration",
            code,
            uid: user.uid,
            nickname,
            roomInstanceId,
            memberSlot: "0",
          };
          saveSession(next);
          return next;
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : String(reason);
          if (/permission|denied/i.test(message)) continue;
          throw reason;
        }
      }
      throw new Error("Could not reserve a collaboration room code. Please try again.");
    },
    [saveSession],
  );

  const joinRoom = useCallback(
    async (rawCode: string, rawNickname: string): Promise<CollaborationRoomSession> => {
      setError(null);
      const code = normalizeRoomCode(rawCode);
      if (!isRoomCode(code)) throw new Error("Enter a valid six-character room code.");
      const nickname = validateNickname(rawNickname);
      const { database, user, db } = await getFirebaseContext();
      const metaRef = db.ref(database, `collaborationRooms/${code}/meta`);
      const memberRef = db.ref(database, `collaborationRooms/${code}/members/${user.uid}`);
      const offsetRef = db.ref(database, ".info/serverTimeOffset");
      const [metaSnapshot, memberSnapshot, offsetSnapshot] = await Promise.all([
        db.get(metaRef),
        db.get(memberRef),
        db.get(offsetRef),
      ]);
      if (!metaSnapshot.exists()) throw new Error("Collaboration room not found or expired.");
      const nextMeta = metaSnapshot.val() as CollaborationRoomMeta;
      const serverNow = Date.now() + (Number(offsetSnapshot.val()) || 0);
      if (
        nextMeta.status !== "open" ||
        nextMeta.schemaVersion !== COLLABORATION_SCHEMA_VERSION ||
        !Number.isFinite(nextMeta.leaseExpiresAt) ||
        nextMeta.leaseExpiresAt <= serverNow
      ) {
        throw new Error("This collaboration room is unavailable or has expired.");
      }

      const existingMember = memberSnapshot.exists()
        ? (memberSnapshot.val() as CollaborationMember)
        : null;
      const claimed = await claimCollaborationMembership(
        { database, user, db },
        code,
        {
          uid: user.uid,
          nickname: existingMember?.nickname ?? nickname,
          joinedAt: existingMember?.joinedAt ?? serverNow,
        },
        isMemberSlot(existingMember?.slot) ? existingMember.slot : undefined,
      );
      const joinedMember = claimed;

      const next: CollaborationRoomSession = {
        kind: "collaboration",
        code,
        uid: user.uid,
        nickname: joinedMember.nickname,
        roomInstanceId: nextMeta.roomInstanceId,
        memberSlot: joinedMember.slot,
      };
      saveSession(next);
      return next;
    },
    [saveSession],
  );

  const leaveRoom = useCallback(async () => {
    const current = session;
    const finishLocalLeave = () => {
      saveSession(null);
      setMeta(null);
      setMembers([]);
      setError(null);
    };
    if (!current || !isFirebaseConfigured) {
      finishLocalLeave();
      return;
    }

    try {
      const { database, user, db } = await getFirebaseContext();
      // A session owned by a previous browser identity cannot be cleaned by
      // the current user. It is safe to discard locally and let its code-only
      // authorization metadata expire with the room lease.
      if (user.uid !== current.uid) {
        finishLocalLeave();
        return;
      }
      const roomRef = db.ref(database, `collaborationRooms/${current.code}`);
      // The fixed-slot rule permits this blind delete only when every occupied
      // authorization slot belongs to the caller (the final logical member).
      try {
        await db.remove(roomRef);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        if (!/permission|denied/i.test(message)) throw reason;
        await db.update(roomRef, {
          [`members/${current.uid}`]: null,
          [`memberSlots/${current.memberSlot}`]: null,
        });
      }
      finishLocalLeave();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      // Keep the session and in-memory notebook mounted so the user can retry
      // after a transient Firebase failure.
      throw reason;
    }
  }, [saveSession, session]);

  const sortedMembers = useMemo(
    () => [...members].sort((left, right) => left.joinedAt - right.joinedAt),
    [members],
  );

  return {
    configured: isFirebaseConfigured,
    authUser,
    authLoading,
    connected,
    session,
    meta,
    members: sortedMembers,
    loading,
    error,
    signIn,
    signOut,
    createRoom,
    joinRoom,
    leaveRoom,
    getIdToken: getFirebaseIdToken,
  };
}
