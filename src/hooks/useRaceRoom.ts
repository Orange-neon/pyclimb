import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  filterProblemBankByTopics,
  parseTopicSelection,
  serializeTopicSelection,
  type CurriculumTopicId,
} from "../data/curriculum";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import { loadProblemBank } from "../data/problemBank";
import type { Problem, ProblemBank } from "../data/problemTypes";
import { getFirebaseContext, isFirebaseConfigured } from "../lib/firebase";
import { sortRoomPlayers } from "../lib/raceLogic";
import type {
  PlayerProgress,
  RoomMeta,
  RoomPlayer,
  RoomSession,
} from "../types/multiplayer";
import type { RaceEvent } from "../types/race";

const SESSION_KEY = "col.multiplayer-session.v0";
const LEGACY_SESSION_KEY = "pyclimb.multiplayer-session.v0";
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EMPTY_PROGRESS: PlayerProgress = { score: 0, solvedCount: 0, solved: {} };

function readSession(): RoomSession | null {
  try {
    const current = localStorage.getItem(SESSION_KEY);
    const legacy = current === null ? localStorage.getItem(LEGACY_SESSION_KEY) : null;
    const session = JSON.parse(current ?? legacy ?? "null") as RoomSession | null;
    if (session && legacy !== null) {
      localStorage.setItem(SESSION_KEY, legacy);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
    return session;
  } catch {
    return null;
  }
}

function makeRoomCode(): string {
  const values = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(values, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join("");
}

function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function useRaceRoom(bank: ProblemBank) {
  const [session, setSessionState] = useState<RoomSession | null>(readSession);
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [progress, setProgress] = useState<PlayerProgress>(EMPTY_PROGRESS);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);
  const serverOffsetRef = useRef(0);

  const saveSession = useCallback((next: RoomSession | null) => {
    setSessionState(next);
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (session) saveSession(null);
      setLoading(false);
      return;
    }
    if (!session) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let cleanups: Array<() => void> = [];
    setLoading(true);
    setProgressLoaded(false);
    setError(null);

    getFirebaseContext()
      .then(({ database, user, db }) => {
        if (cancelled) return;
        const { limitToLast, off, onDisconnect, onValue, orderByChild, query, ref, set } = db;
        if (user.uid !== session.uid) {
          saveSession(null);
          throw new Error("This room session belongs to a different browser identity.");
        }

        const roomRef = ref(database, `rooms/${session.code}`);
        const metaRef = ref(database, `rooms/${session.code}/meta`);
        const leaderboardRef = ref(database, `rooms/${session.code}/leaderboard`);
        const progressRef = ref(database, `rooms/${session.code}/progress/${session.uid}`);
        const eventsRef = query(
          ref(database, `rooms/${session.code}/events`),
          orderByChild("createdAt"),
          limitToLast(25),
        );
        const offsetRef = ref(database, ".info/serverTimeOffset");
        const connectedRef = ref(database, ".info/connected");

        cleanups = [
          onValue(metaRef, (snapshot) => {
            if (!snapshot.exists()) {
              saveSession(null);
              setError("This room has been closed.");
              return;
            }
            setMeta(snapshot.val() as RoomMeta);
            setLoading(false);
          }),
          onValue(leaderboardRef, (snapshot) => {
            const value = (snapshot.val() ?? {}) as Record<string, RoomPlayer>;
            setPlayers(Object.values(value));
          }),
          onValue(progressRef, (snapshot) => {
            if (session.role === "player") {
              setProgress((snapshot.val() as PlayerProgress | null) ?? EMPTY_PROGRESS);
              setProgressLoaded(true);
            }
          }),
          onValue(eventsRef, (snapshot) => {
            const value = (snapshot.val() ?? {}) as Record<string, Omit<RaceEvent, "id">>;
            setEvents(
              Object.entries(value)
                .map(([id, item]) => ({ id, ...item }))
                .sort((a, b) => b.createdAt - a.createdAt),
            );
          }),
          onValue(offsetRef, (snapshot) => {
            serverOffsetRef.current = snapshot.val() ?? 0;
          }),
          onValue(connectedRef, (snapshot) => {
            setConnected(snapshot.val() === true);
          }),
        ];

        const presenceRef =
          session.role === "host"
            ? ref(database, `rooms/${session.code}/meta/hostOnline`)
            : ref(database, `rooms/${session.code}/leaderboard/${session.uid}/online`);
        set(presenceRef, true);
        const disconnect = onDisconnect(presenceRef);
        disconnect.set(false);
        cleanups.push(() => disconnect.cancel());
        cleanups.push(() => off(roomRef));
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [saveSession, session]);

  useEffect(() => {
    if (!session || session.role !== "player" || !progressLoaded || !meta) return;
    const player = players.find((item) => item.uid === session.uid);
    if (
      !player ||
      (player.score === progress.score && player.correctCount === progress.solvedCount)
    ) {
      return;
    }

    let cancelled = false;
    getFirebaseContext()
      .then(({ database, db }) =>
        db.update(db.ref(database, `rooms/${session.code}/leaderboard/${session.uid}`), {
          score: progress.score,
          correctCount: progress.solvedCount,
        }),
      )
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [meta, players, progress.score, progress.solvedCount, progressLoaded, session]);

  const addEvent = useCallback(
    async (message: string, tone: RaceEvent["tone"] = "neutral") => {
      if (!session) return;
      const { database, user, db } = await getFirebaseContext();
      const { push, ref, set } = db;
      await set(push(ref(database, `rooms/${session.code}/events`)), {
        uid: user.uid,
        message,
        tone,
        createdAt: Date.now() + serverOffsetRef.current,
      });
    },
    [session],
  );

  const createRoom = useCallback(
    async (topicIds: CurriculumTopicId[], durationMinutes = 30): Promise<RoomSession> => {
      const scopedBank = filterProblemBankByTopics(bank, topicIds);
      if (!scopedBank.problems.length) {
        throw new Error("Choose at least one topic that has available challenges.");
      }
      const { database, user, db } = await getFirebaseContext();
      const { ref, runTransaction } = db;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = makeRoomCode();
        const roomRef = ref(database, `rooms/${code}`);
        const now = Date.now() + serverOffsetRef.current;
        const result = await runTransaction(
          roomRef,
          (current) =>
            current === null
              ? {
                  meta: {
                    hostUid: user.uid,
                    hostOnline: true,
                    status: "lobby",
                    bankVersion: bank.version,
                    topicIds: serializeTopicSelection(topicIds),
                    problemCount: scopedBank.problems.length,
                    durationSeconds: durationMinutes * 60,
                    createdAt: now,
                    startedAt: null,
                    endsAt: null,
                    endedAt: null,
                    endReason: null,
                  },
                }
              : undefined,
          { applyLocally: false },
        );
        if (result.committed) {
          const next = { code, uid: user.uid, role: "host" as const };
          saveSession(next);
          return next;
        }
      }
      throw new Error("Could not reserve a room code. Please try again.");
    },
    [bank, saveSession],
  );

  const joinRoom = useCallback(
    async (rawCode: string, rawNickname: string): Promise<RoomSession> => {
      const code = rawCode.trim().toUpperCase();
      const nickname = rawNickname.trim().replace(/\s+/g, " ");
      if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error("Enter a valid six-character room code.");
      if (nickname.length < 2 || nickname.length > 20) {
        throw new Error("Nickname must be between 2 and 20 characters.");
      }

      const { database, user, db } = await getFirebaseContext();
      const { get, push, ref, set, update } = db;
      const roomRef = ref(database, `rooms/${code}`);
      const snapshot = await get(roomRef);
      if (!snapshot.exists()) throw new Error("Room not found.");
      const room = snapshot.val() as {
        meta: RoomMeta;
        leaderboard?: Record<string, RoomPlayer>;
      };
      if (room.meta.status !== "lobby") throw new Error("That race has already started.");
      const roomBank = await loadProblemBank(room.meta.bankVersion).catch(() => {
        throw new Error(`This build does not include problem bank ${room.meta.bankVersion}.`);
      });
      const selectedTopics = parseTopicSelection(room.meta.topicIds);
      const scopedBank = selectedTopics
        ? filterProblemBankByTopics(roomBank, selectedTopics)
        : roomBank;
      if (!scopedBank.problems.length || scopedBank.problems.length !== room.meta.problemCount) {
        throw new Error("This room's topic selection is not compatible with this build.");
      }
      const existingPlayers = Object.values(room.leaderboard ?? {});
      if (existingPlayers.length >= 30) throw new Error("That room is full.");
      const normalizedNickname = normalizeNickname(nickname);
      if (
        existingPlayers.some(
          (player) => player.uid !== user.uid && player.normalizedNickname === normalizedNickname,
        )
      ) {
        throw new Error("That nickname is already in the room.");
      }

      const now = Date.now() + serverOffsetRef.current;
      const player: RoomPlayer = {
        uid: user.uid,
        nickname,
        normalizedNickname,
        score: 0,
        correctCount: 0,
        joinedAt: now,
        lastAcceptedAt: null,
        online: true,
        ready: false,
      };
      await update(roomRef, {
        [`leaderboard/${user.uid}`]: player,
        [`progress/${user.uid}`]: EMPTY_PROGRESS,
      });
      const next = { code, uid: user.uid, role: "player" as const, nickname };
      saveSession(next);
      await set(push(ref(database, `rooms/${code}/events`)), {
        uid: user.uid,
        message: `${nickname} joined the room`,
        tone: "neutral",
        createdAt: now,
      });
      return next;
    },
    [bank.version, saveSession],
  );

  const setReady = useCallback(
    async (ready: boolean) => {
      if (!session || session.role !== "player") return;
      const { database, db } = await getFirebaseContext();
      const { ref, set } = db;
      await set(ref(database, `rooms/${session.code}/leaderboard/${session.uid}/ready`), ready);
    },
    [session],
  );

  const setDuration = useCallback(
    async (minutes: number) => {
      if (!session || session.role !== "host") return;
      const { database, db } = await getFirebaseContext();
      const { ref, set } = db;
      await set(
        ref(database, `rooms/${session.code}/meta/durationSeconds`),
        Math.min(120, Math.max(1, Math.round(minutes))) * 60,
      );
    },
    [session],
  );

  const startRace = useCallback(async () => {
    if (!session || session.role !== "host" || !meta) return;
    const { database, db } = await getFirebaseContext();
    const { ref, update } = db;
    const now = Date.now() + serverOffsetRef.current;
    await update(ref(database, `rooms/${session.code}/meta`), {
      status: "active",
      startedAt: now,
      endsAt: now + meta.durationSeconds * 1000,
      endedAt: null,
      endReason: null,
    });
    await addEvent("The host started the race", "good");
  }, [addEvent, meta, session]);

  const finishRace = useCallback(
    async (reason: "time" | "host" | "completed") => {
      if (!session || !meta || meta.status !== "active") return;
      const { database, db } = await getFirebaseContext();
      const { ref, update } = db;
      await update(ref(database, `rooms/${session.code}/meta`), {
        status: "finished",
        endedAt: Date.now() + serverOffsetRef.current,
        endReason: reason,
      });
    },
    [meta, session],
  );

  const recordSolve = useCallback(
    async (problem: Problem) => {
      if (!session || session.role !== "player" || meta?.status !== "active") {
        throw new Error("The race is not active.");
      }
      const { database, db } = await getFirebaseContext();
      const { ref, runTransaction, update } = db;
      const progressRef = ref(database, `rooms/${session.code}/progress/${session.uid}`);
      const points = DIFFICULTY_CONFIG[problem.difficulty].points;
      const now = Date.now() + serverOffsetRef.current;
      const result = await runTransaction(progressRef, (current: PlayerProgress | null) => {
        const value = current ?? EMPTY_PROGRESS;
        if (value.solved?.[problem.id]) return undefined;
        return {
          score: value.score + points,
          solvedCount: value.solvedCount + 1,
          solved: { ...(value.solved ?? {}), [problem.id]: now },
        };
      });
      if (!result.committed) return;
      const next = result.snapshot.val() as PlayerProgress;
      await update(ref(database, `rooms/${session.code}/leaderboard/${session.uid}`), {
        score: next.score,
        correctCount: next.solvedCount,
        lastAcceptedAt: now,
      });
      await addEvent(`${session.nickname} solved ${problem.title} (+${points})`, "good");
      if (next.solvedCount >= meta.problemCount) await finishRace("completed");
    },
    [addEvent, finishRace, meta, session],
  );

  const recordForfeit = useCallback(
    async (problem: Problem) => {
      if (!session || session.role !== "player" || meta?.status !== "active") {
        throw new Error("The race is not active.");
      }
      const { database, db } = await getFirebaseContext();
      const { ref, runTransaction, update } = db;
      const progressRef = ref(database, `rooms/${session.code}/progress/${session.uid}`);
      const penalty = DIFFICULTY_CONFIG[problem.difficulty].penalty;
      const result = await runTransaction(progressRef, (current: PlayerProgress | null) => {
        const value = current ?? EMPTY_PROGRESS;
        return { ...value, score: value.score - penalty };
      });
      const next = result.snapshot.val() as PlayerProgress;
      await update(ref(database, `rooms/${session.code}/leaderboard/${session.uid}`), {
        score: next.score,
      });
      await addEvent(`${session.nickname} forfeited ${problem.title} (-${penalty})`, "bad");
    },
    [addEvent, meta, session],
  );

  const rematch = useCallback(async () => {
    if (!session || session.role !== "host" || !meta) return;
    const { database, db } = await getFirebaseContext();
    const { ref, update } = db;
    const updates: Record<string, unknown> = {
      "meta/status": "lobby",
      "meta/startedAt": null,
      "meta/endsAt": null,
      "meta/endedAt": null,
      "meta/endReason": null,
      events: null,
    };
    for (const player of players) {
      updates[`leaderboard/${player.uid}/score`] = 0;
      updates[`leaderboard/${player.uid}/correctCount`] = 0;
      updates[`leaderboard/${player.uid}/lastAcceptedAt`] = null;
      updates[`leaderboard/${player.uid}/ready`] = false;
      updates[`progress/${player.uid}`] = EMPTY_PROGRESS;
    }
    await update(ref(database, `rooms/${session.code}`), updates);
  }, [meta, players, session]);

  const leaveRoom = useCallback(async () => {
    const current = session;
    saveSession(null);
    setMeta(null);
    setPlayers([]);
    setProgress(EMPTY_PROGRESS);
    setProgressLoaded(false);
    setEvents([]);
    if (!current || !isFirebaseConfigured) return;
    const { database, db } = await getFirebaseContext();
    const { ref, remove, set } = db;
    if (current.role === "player") {
      if (meta?.status === "lobby") {
        await remove(ref(database, `rooms/${current.code}/leaderboard/${current.uid}`));
        await remove(ref(database, `rooms/${current.code}/progress/${current.uid}`));
      } else {
        await set(ref(database, `rooms/${current.code}/leaderboard/${current.uid}/online`), false);
      }
    }
  }, [meta?.status, saveSession, session]);

  const closeRoom = useCallback(async () => {
    if (!session || session.role !== "host") return;
    const { database, db } = await getFirebaseContext();
    const { ref, remove } = db;
    await remove(ref(database, `rooms/${session.code}`));
    saveSession(null);
  }, [saveSession, session]);

  const sortedPlayers = useMemo(() => sortRoomPlayers(players), [players]);

  return {
    configured: isFirebaseConfigured,
    connected,
    session,
    meta,
    players: sortedPlayers,
    progress,
    events,
    loading,
    error,
    serverNow: () => Date.now() + serverOffsetRef.current,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    setReady,
    setDuration,
    startRace,
    finishRace,
    recordSolve,
    recordForfeit,
    rematch,
  };
}
