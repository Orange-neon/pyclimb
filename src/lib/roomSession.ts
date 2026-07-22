import type { CollaborationRoomSession } from "../types/collaboration";
import type { RoomSession } from "../types/multiplayer";

export const ACTIVE_ROOM_SESSION_KEY = "col.multiplayer-session.v1";
export const LEGACY_RACE_SESSION_KEY = "col.multiplayer-session.v0";
export const LEGACY_PYCLIMB_SESSION_KEY = "pyclimb.multiplayer-session.v0";

const SESSION_EVENT = "col:active-room-session";

export type RaceActiveRoomSession = RoomSession & { kind: "race" };
export type ActiveRoomSession = RaceActiveRoomSession | CollaborationRoomSession;
export type ActiveSession = ActiveRoomSession;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRaceRole(value: unknown): value is RoomSession["role"] {
  return value === "host" || value === "player";
}

function parseRaceSession(value: unknown): RaceActiveRoomSession | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.code !== "string" ||
    typeof value.uid !== "string" ||
    !isRaceRole(value.role) ||
    (value.nickname !== undefined && typeof value.nickname !== "string")
  ) {
    return null;
  }
  return {
    kind: "race",
    code: value.code,
    uid: value.uid,
    role: value.role,
    ...(typeof value.nickname === "string" ? { nickname: value.nickname } : {}),
  };
}

function parseCollaborationSession(value: unknown): CollaborationRoomSession | null {
  if (!isRecord(value) || value.kind !== "collaboration") return null;
  if (
    typeof value.code !== "string" ||
    !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value.code) ||
    typeof value.uid !== "string" ||
    value.uid.length === 0 ||
    value.uid.length > 128 ||
    typeof value.nickname !== "string" ||
    value.nickname.length < 2 ||
    value.nickname.length > 20 ||
    typeof value.roomInstanceId !== "string" ||
    !/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(
      value.roomInstanceId,
    ) ||
    typeof value.memberSlot !== "string" ||
    !/^(?:[0-9]|[12][0-9])$/.test(value.memberSlot)
  ) {
    return null;
  }
  return {
    kind: "collaboration",
    code: value.code,
    uid: value.uid,
    nickname: value.nickname,
    roomInstanceId: value.roomInstanceId,
    memberSlot: value.memberSlot,
  };
}

function parseActiveSession(value: unknown): ActiveRoomSession | null {
  if (!isRecord(value)) return null;
  return value.kind === "collaboration"
    ? parseCollaborationSession(value)
    : value.kind === "race"
      ? parseRaceSession(value)
      : null;
}

function parseStoredValue(value: string | null): unknown {
  if (value === null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function emitSessionChange(session: ActiveRoomSession | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: session }));
}

export function readActiveRoomSession(storage: Storage = window.localStorage): ActiveRoomSession | null {
  try {
    const current = parseActiveSession(parseStoredValue(storage.getItem(ACTIVE_ROOM_SESSION_KEY)));
    if (current) return current;

    const legacyValue =
      storage.getItem(LEGACY_RACE_SESSION_KEY) ?? storage.getItem(LEGACY_PYCLIMB_SESSION_KEY);
    const legacy = parseRaceSession(parseStoredValue(legacyValue));
    if (!legacy) return null;

    storage.setItem(ACTIVE_ROOM_SESSION_KEY, JSON.stringify(legacy));
    storage.removeItem(LEGACY_RACE_SESSION_KEY);
    storage.removeItem(LEGACY_PYCLIMB_SESSION_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function writeActiveRoomSession(
  session: ActiveRoomSession,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(ACTIVE_ROOM_SESSION_KEY, JSON.stringify(session));
  storage.removeItem(LEGACY_RACE_SESSION_KEY);
  storage.removeItem(LEGACY_PYCLIMB_SESSION_KEY);
  emitSessionChange(session);
}

export function writeRaceRoomSession(
  session: RoomSession,
  storage: Storage = window.localStorage,
): void {
  writeActiveRoomSession({ kind: "race", ...session }, storage);
}

export function clearActiveRoomSession(
  kind?: ActiveRoomSession["kind"],
  storage: Storage = window.localStorage,
): void {
  const current = readActiveRoomSession(storage);
  if (kind && current?.kind !== kind) return;
  storage.removeItem(ACTIVE_ROOM_SESSION_KEY);
  storage.removeItem(LEGACY_RACE_SESSION_KEY);
  storage.removeItem(LEGACY_PYCLIMB_SESSION_KEY);
  emitSessionChange(null);
}

export function getRaceRoomSession(session: ActiveRoomSession | null): RoomSession | null {
  if (session?.kind !== "race") return null;
  const { kind: _kind, ...raceSession } = session;
  return raceSession;
}

export function getCollaborationRoomSession(
  session: ActiveRoomSession | null,
): CollaborationRoomSession | null {
  return session?.kind === "collaboration" ? session : null;
}

export function subscribeActiveRoomSession(
  listener: (session: ActiveRoomSession | null) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onSessionEvent = (event: Event) => {
    listener((event as CustomEvent<ActiveRoomSession | null>).detail ?? null);
  };
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === ACTIVE_ROOM_SESSION_KEY ||
      event.key === LEGACY_RACE_SESSION_KEY ||
      event.key === LEGACY_PYCLIMB_SESSION_KEY
    ) {
      listener(readActiveRoomSession());
    }
  };
  window.addEventListener(SESSION_EVENT, onSessionEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SESSION_EVENT, onSessionEvent);
    window.removeEventListener("storage", onStorage);
  };
}
