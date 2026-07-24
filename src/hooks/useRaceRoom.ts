import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  filterProblemBankByTopics,
  parseTopicSelection,
  serializeTopicSelection,
  type CurriculumTopicId,
} from "../data/curriculum";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import { loadProblemBank } from "../data/problemBank";
import { getProblemReward } from "../data/problemProgression";
import type { Problem, ProblemBank } from "../data/problemTypes";
import { BOMB_PENALTY, DOUBLE_MULTIPLIER } from "../data/timedProblems";
import {
  getFirebaseContext,
  isFirebaseConfigured,
  observeGoogleUser,
  signInWithGoogle,
  signOutFirebase,
  type GoogleUserProfile,
} from "../lib/firebase";
import { sortRoomPlayers } from "../lib/raceLogic";
import { CHALLENGER_WIN_PRIZE } from "../lib/challengeLogic";
import { generateRoomCode, isRoomCode, normalizeRoomCode } from "../lib/roomCode";
import {
  clearActiveRoomSession,
  getRaceRoomSession,
  readActiveRoomSession,
  subscribeActiveRoomSession,
  writeRaceRoomSession,
} from "../lib/roomSession";
import {
  createRaceActivityWriteQueue,
  promoteRaceSpectatorAfterActivityCleanup,
  updateRaceActivityRecord,
} from "../lib/raceActivity";
import {
  closeRaceRoomIfChallengeSettled,
  createRaceProgress,
  expireRaceBomb,
  finishActiveRace,
  forfeitRaceProblem,
  missRaceProblem,
  moveRacePlayerToSpectators,
  moveRaceSpectatorToPlayers,
  normalizeRaceProgress as normalizeProgress,
  resetRaceForRematch,
  settleCurrentChallengeAwards,
  solveRaceProblem,
  startReadyRace,
  type RaceRoomLifecycleState,
} from "../lib/raceRoomLifecycle";
import type {
  PlayerProgress,
  RaceActivity,
  RoomChallenge,
  RoomMeta,
  RoomPlayer,
  RoomSpectator,
  RoomSession,
} from "../types/multiplayer";
import type { RaceEvent } from "../types/race";

function readSession(): RoomSession | null {
  return getRaceRoomSession(readActiveRoomSession());
}

function normalizeNickname(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hasGoogleProvider(user: { providerData: Array<{ providerId: string }> }): boolean {
  return user.providerData.some((provider) => provider.providerId === "google.com");
}

export function useRaceRoom(bank: ProblemBank) {
  const [session, setSessionState] = useState<RoomSession | null>(readSession);
  const [authUser, setAuthUser] = useState<GoogleUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [spectators, setSpectators] = useState<RoomSpectator[]>([]);
  const [activities, setActivities] = useState<Record<string, RaceActivity>>({});
  const [activityError, setActivityError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlayerProgress>(createRaceProgress);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [challenge, setChallenge] = useState<RoomChallenge | null>(null);
  const [challengeLoadedFor, setChallengeLoadedFor] = useState<string | null>(
    null,
  );
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);
  const serverOffsetRef = useRef(0);
  const activityWriteQueueRef = useRef(createRaceActivityWriteQueue());
  const challengeSubscriptionKey = session
    ? `${session.code}:${session.uid}:${session.role}`
    : null;
  const challengeLoaded = Boolean(
    challengeSubscriptionKey &&
      challengeLoadedFor === challengeSubscriptionKey,
  );

  const saveSession = useCallback((next: RoomSession | null) => {
    setSessionState(next);
    if (next) writeRaceRoomSession(next);
    else clearActiveRoomSession("race");
  }, []);

  useEffect(
    () =>
      subscribeActiveRoomSession((activeSession) => {
        setSessionState(getRaceRoomSession(activeSession));
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
      setLoading(false);
      return;
    }

    let cancelled = false;
    let cleanups: Array<() => void> = [];
    setLoading(true);
    setProgressLoaded(false);
    setChallenge(null);
    setChallengeLoadedFor(null);
    setError(null);

    getFirebaseContext()
      .then(({ database, user, db }) => {
        if (cancelled) return;
        const currentChallengeSubscriptionKey = `${session.code}:${session.uid}:${session.role}`;
        const { limitToLast, off, onValue, orderByChild, query, ref } = db;
        if (user.uid !== session.uid) {
          saveSession(null);
          throw new Error("This room session belongs to a different browser identity.");
        }

        const roomRef = ref(database, `rooms/${session.code}`);
        const metaRef = ref(database, `rooms/${session.code}/meta`);
        const leaderboardRef = ref(database, `rooms/${session.code}/leaderboard`);
        const spectatorsRef = ref(database, `rooms/${session.code}/spectators`);
        const progressRef = ref(database, `rooms/${session.code}/progress/${session.uid}`);
        const challengeRef = ref(database, `rooms/${session.code}/challenge`);
        const eventsRef = query(
          ref(database, `rooms/${session.code}/events`),
          orderByChild("createdAt"),
          limitToLast(25),
        );
        const offsetRef = ref(database, ".info/serverTimeOffset");
        const connectedRef = ref(database, ".info/connected");
        let latestMeta: RoomMeta | null | undefined;
        let latestLeaderboard: Record<string, RoomPlayer> | undefined;
        let latestSpectators: Record<string, RoomSpectator> | undefined;
        let initialProgressReady = false;
        let leaderboardRevision = 0;
        let spectatorRevision = 0;
        let resolvedLeaderboardRevision = 0;
        let resolvedSpectatorRevision = 0;
        let membershipTimer: number | undefined;
        const resolveSessionMembership = () => {
          membershipTimer = undefined;
          if (
            latestMeta === undefined ||
            latestLeaderboard === undefined ||
            latestSpectators === undefined
          ) {
            return;
          }
          if (!latestMeta) {
            saveSession(null);
            return;
          }
          if (session.role === "host") {
            if (latestMeta.hostUid !== session.uid) {
              saveSession(null);
              return;
            }
            setLoading(false);
            return;
          }
          const spectator = latestSpectators[session.uid];
          if (spectator) {
            resolvedLeaderboardRevision = leaderboardRevision;
            resolvedSpectatorRevision = spectatorRevision;
            if (session.role !== "spectator") {
              saveSession({
                code: session.code,
                uid: session.uid,
                role: "spectator",
                nickname: spectator.nickname,
              });
            } else {
              setLoading(false);
            }
            return;
          }
          const player = latestLeaderboard[session.uid];
          if (player) {
            if (!initialProgressReady) {
              return;
            }
            resolvedLeaderboardRevision = leaderboardRevision;
            resolvedSpectatorRevision = spectatorRevision;
            if (session.role !== "player") {
              saveSession({
                code: session.code,
                uid: session.uid,
                role: "player",
                nickname: player.nickname,
              });
            } else {
              setLoading(false);
            }
            return;
          }
          if (
            leaderboardRevision <= resolvedLeaderboardRevision ||
            spectatorRevision <= resolvedSpectatorRevision
          ) {
            return;
          }
          saveSession(null);
        };
        const scheduleSessionMembershipResolution = () => {
          if (membershipTimer !== undefined) window.clearTimeout(membershipTimer);
          membershipTimer = window.setTimeout(resolveSessionMembership, 0);
        };

        cleanups = [
          onValue(metaRef, (snapshot) => {
            if (!snapshot.exists()) {
              latestMeta = null;
              saveSession(null);
              setError("This room has been closed.");
              return;
            }
            const value = snapshot.val() as RoomMeta;
            latestMeta = value;
            setMeta(value);
            scheduleSessionMembershipResolution();
          }),
          onValue(leaderboardRef, (snapshot) => {
            const value = (snapshot.val() ?? {}) as Record<string, RoomPlayer>;
            leaderboardRevision += 1;
            latestLeaderboard = value;
            setPlayers(Object.values(value));
            scheduleSessionMembershipResolution();
          }),
          onValue(spectatorsRef, (snapshot) => {
            const value = (snapshot.val() ?? {}) as Record<string, RoomSpectator>;
            spectatorRevision += 1;
            latestSpectators = value;
            const nextSpectators = Object.values(value);
            setSpectators(nextSpectators);
            scheduleSessionMembershipResolution();
          }),
          onValue(progressRef, (snapshot) => {
            initialProgressReady = true;
            if (session.role === "player") {
              setProgress(normalizeProgress(snapshot.val() as PlayerProgress | null));
              setProgressLoaded(true);
            }
            scheduleSessionMembershipResolution();
          }),
          onValue(challengeRef, (snapshot) => {
            setChallenge(snapshot.exists() ? (snapshot.val() as RoomChallenge) : null);
            setChallengeLoadedFor(currentChallengeSubscriptionKey);
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

        cleanups.push(() => {
          if (membershipTimer !== undefined) window.clearTimeout(membershipTimer);
        });
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
    if (!connected || !session || !meta) return;
    let cancelled = false;
    let disconnect:
      | {
          cancel: () => Promise<void>;
          set: (value: unknown) => Promise<void>;
        }
      | undefined;
    getFirebaseContext()
      .then(async ({ database, db }) => {
        if (cancelled) return;
        const presenceRef =
          session.role === "host"
            ? db.ref(database, `rooms/${session.code}/meta/hostOnline`)
            : session.role === "spectator"
              ? db.ref(database, `rooms/${session.code}/spectators/${session.uid}/online`)
              : db.ref(database, `rooms/${session.code}/leaderboard/${session.uid}/online`);
        await db.set(presenceRef, true);
        if (cancelled) return;
        disconnect = db.onDisconnect(presenceRef);
        await disconnect.set(false);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void disconnect?.cancel().catch(() => undefined);
    };
  }, [connected, meta?.createdAt, session]);

  useEffect(() => {
    if (
      !session ||
      !meta ||
      meta.status !== "active" ||
      (session.role !== "host" && session.role !== "spectator")
    ) {
      setActivities({});
      setActivityError(null);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    setActivities({});
    getFirebaseContext()
      .then(({ database, db }) => {
        if (cancelled) return;
        setActivityError(null);
        const activityRef = db.ref(
          database,
          `raceActivity/${session.code}/${meta.createdAt}`,
        );
        let failed = false;
        const handleFailure = () => {
          if (cancelled || failed) return;
          failed = true;
          setActivities({});
          setActivityError(
            "Live code monitoring is unavailable. Publish the included Firebase database rules, then reconnect.",
          );
        };
        const applySnapshot = (snapshot: {
          key: string | null;
          val: () => unknown;
        }) => {
          if (!snapshot.key) return;
          setActivities((current) =>
            updateRaceActivityRecord(
              current,
              snapshot.key!,
              snapshot.val() as RaceActivity,
            ),
          );
          setActivityError(null);
        };
        const removeSnapshot = (snapshot: { key: string | null }) => {
          if (!snapshot.key) return;
          setActivities((current) =>
            updateRaceActivityRecord(current, snapshot.key!, null),
          );
        };
        const cleanups = [
          db.onChildAdded(activityRef, applySnapshot, handleFailure),
          db.onChildChanged(activityRef, applySnapshot, handleFailure),
          db.onChildRemoved(activityRef, removeSnapshot, handleFailure),
        ];
        unsubscribe = () => cleanups.forEach((cleanup) => cleanup());
        /*
         * Child listeners keep updates proportional to the contestant who changed.
         * An onValue listener would redownload every contestant's source on each edit.
         */
      })
      .catch(() => {
        if (!cancelled) {
          setActivities({});
          setActivityError("Live code monitoring could not connect.");
        }
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [meta?.createdAt, meta?.status, session]);

  useEffect(() => {
    if (!connected || !session || session.role !== "player" || !meta) return;
    let cancelled = false;
    let disconnect:
      | {
          cancel: () => Promise<void>;
          remove: () => Promise<void>;
        }
      | undefined;
    getFirebaseContext()
      .then(({ database, db }) => {
        if (cancelled) return;
        const activityRef = db.ref(
          database,
          `raceActivity/${session.code}/${meta.createdAt}/${session.uid}`,
        );
        disconnect = db.onDisconnect(activityRef);
        void disconnect.remove().catch(() => undefined);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void disconnect?.cancel().catch(() => undefined);
    };
  }, [connected, meta?.createdAt, session]);

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
        const code = generateRoomCode();
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
                    unlimited: false,
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
      const code = normalizeRoomCode(rawCode);
      const nickname = rawNickname.trim().replace(/\s+/g, " ");
      if (!isRoomCode(code)) throw new Error("Enter a valid six-character room code.");

      const { database, user, db } = await getFirebaseContext();
      const { get, push, ref, set, update } = db;
      const roomRef = ref(database, `rooms/${code}`);
      const snapshot = await get(roomRef).catch((reason) => {
        if (!hasGoogleProvider(user)) {
          throw new Error("Sign in with Google to join an unlimited room, or check the room code.");
        }
        throw reason;
      });
      if (!snapshot.exists()) throw new Error("Room not found.");
      const room = snapshot.val() as {
        meta: RoomMeta;
        leaderboard?: Record<string, RoomPlayer>;
        spectators?: Record<string, RoomSpectator>;
      };
      if (room.meta.unlimited && !hasGoogleProvider(user)) {
        throw new Error("Sign in with Google to join unlimited rooms.");
      }
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
      const existingSpectators = Object.values(room.spectators ?? {});
      if (room.meta.hostUid === user.uid) {
        const next = { code, uid: user.uid, role: "host" as const };
        saveSession(next);
        return next;
      }
      const returningSpectator = room.spectators?.[user.uid];
      if (returningSpectator) {
        await update(roomRef, { [`spectators/${user.uid}/online`]: true });
        const next = {
          code,
          uid: user.uid,
          role: "spectator" as const,
          nickname: returningSpectator.nickname,
        };
        saveSession(next);
        return next;
      }
      const returningPlayer = room.leaderboard?.[user.uid];
      if (returningPlayer) {
        await update(roomRef, { [`leaderboard/${user.uid}/online`]: true });
        const next = {
          code,
          uid: user.uid,
          role: "player" as const,
          nickname: returningPlayer.nickname,
        };
        saveSession(next);
        return next;
      }
      if (room.meta.status !== "lobby") {
        throw new Error("This race has already started. Only returning participants can resume it.");
      }
      if (nickname.length < 2 || nickname.length > 20) {
        throw new Error("Nickname must be between 2 and 20 characters.");
      }
      if (existingPlayers.length + existingSpectators.length >= 30) {
        throw new Error("That room is full.");
      }
      const normalizedNickname = normalizeNickname(nickname);
      if (
        [...existingPlayers, ...existingSpectators].some(
          (participant) =>
            participant.uid !== user.uid &&
            participant.normalizedNickname === normalizedNickname,
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
        [`progress/${user.uid}`]: createRaceProgress(),
      });
      const next = { code, uid: user.uid, role: "player" as const, nickname };
      saveSession(next);
      await set(
        push(ref(database, `rooms/${code}/events`)),
        {
          uid: user.uid,
          message: `${nickname} joined the room`,
          tone: "neutral",
          createdAt: now,
        },
      ).catch(() => undefined);
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

  const publishActivity = useCallback(
    (activity: Omit<RaceActivity, "updatedAt"> | null): Promise<void> => {
      if (!session || session.role !== "player" || !meta) return Promise.resolve();
      const target = {
        code: session.code,
        uid: session.uid,
        createdAt: meta.createdAt,
        active: meta.status === "active",
      };
      const targetKey = `${target.code}/${target.createdAt}/${target.uid}`;
      return activityWriteQueueRef.current.enqueue(targetKey, async () => {
        const { database, db } = await getFirebaseContext();
        const activityRef = db.ref(
          database,
          `raceActivity/${target.code}/${target.createdAt}/${target.uid}`,
        );
        if (!activity) {
          await db.remove(activityRef);
          return;
        }
        if (!target.active) return;
        await db.set(activityRef, {
          ...activity,
          source: activity.source.slice(0, 50_000),
          updatedAt: Date.now() + serverOffsetRef.current,
        } satisfies RaceActivity);
      }, activity ? "publish" : "clear");
    },
    [meta?.createdAt, meta?.status, session],
  );

  const makeSpectator = useCallback(
    async (uid: string) => {
      if (!session || session.role !== "host" || !meta) return;
      const player = players.find((item) => item.uid === uid);
      if (!player) throw new Error("That contestant is no longer in the race.");
      const now = Date.now() + serverOffsetRef.current;
      const roomPath = `rooms/${session.code}`;
      const { database, db } = await getFirebaseContext();
      const roomRef = db.ref(database, roomPath);
      await db.get(roomRef);
      const result = await db.runTransaction(
        roomRef,
        (
          current:
            | {
                meta: RoomMeta;
                leaderboard?: Record<string, RoomPlayer>;
                spectators?: Record<string, RoomSpectator>;
                progress?: Record<string, PlayerProgress>;
                challenge?: RoomChallenge;
              }
            | null,
        ) => moveRacePlayerToSpectators(current, uid, now),
      );
      if (!result.committed) {
        throw new Error("That contestant is no longer in the race.");
      }
      await db.remove(
        db.ref(
          database,
          `raceActivity/${session.code}/${meta.createdAt}/${uid}`,
        ),
      ).catch(() => undefined);
      await addEvent(`${player.nickname} is now a spectator`, "neutral").catch(
        () => undefined,
      );
    },
    [addEvent, meta, players, session],
  );

  const makePlayer = useCallback(
    async (uid: string) => {
      if (!session || session.role !== "host" || !meta) return;
      if (meta.status === "finished") {
        throw new Error("Start a rematch before adding contestants back to the race.");
      }
      const spectator = spectators.find((item) => item.uid === uid);
      if (!spectator) throw new Error("That spectator is no longer in the room.");
      const roomPath = `rooms/${session.code}`;
      const { database, db } = await getFirebaseContext();
      const roomRef = db.ref(database, roomPath);
      await db.get(roomRef);
      const activityRef = db.ref(
        database,
        `raceActivity/${session.code}/${meta.createdAt}/${uid}`,
      );
      const result = await promoteRaceSpectatorAfterActivityCleanup(
        () => db.remove(activityRef),
        () =>
          db.runTransaction(
            roomRef,
            (
              current:
                | {
                    meta: RoomMeta;
                    leaderboard?: Record<string, RoomPlayer>;
                    spectators?: Record<string, RoomSpectator>;
                    progress?: Record<string, PlayerProgress>;
                    challenge?: RoomChallenge;
                  }
                | null,
            ) => moveRaceSpectatorToPlayers(current, uid),
          ),
      );
      if (!result.committed) {
        throw new Error("That spectator is no longer in the room.");
      }
      await addEvent(`${spectator.nickname} is now a contestant`, "neutral").catch(
        () => undefined,
      );
    },
    [addEvent, meta, session, spectators],
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

  const setUnlimited = useCallback(
    async (unlimited: boolean) => {
      if (!session || session.role !== "host" || meta?.status !== "lobby") return;
      if (unlimited && !authUser) {
        const user = await signInWithGoogle();
        setAuthUser(user);
      }
      const { database, user, db } = await getFirebaseContext({ requireGoogle: unlimited });
      if (unlimited && user.uid !== session.uid) {
        saveSession(null);
        throw new Error("This Google account cannot manage the current room. Create a new room after signing in.");
      }
      await db.set(db.ref(database, `rooms/${session.code}/meta/unlimited`), unlimited);
    },
    [authUser, meta?.status, saveSession, session],
  );

  const startRace = useCallback(async () => {
    if (!session || session.role !== "host" || !meta) return;
    const { database, user, db } = await getFirebaseContext({ requireGoogle: Boolean(meta.unlimited) });
    if (meta.unlimited && user.uid !== session.uid) {
      throw new Error("Sign in with the room host account to start an unlimited room.");
    }
    const now = Date.now() + serverOffsetRef.current;
    const roomRef = db.ref(database, `rooms/${session.code}`);
    await db.get(roomRef);
    const result = await db.runTransaction(
      roomRef,
      (
        current: {
          meta: RoomMeta;
          leaderboard?: Record<string, RoomPlayer>;
        } | null,
      ) => startReadyRace(current, now),
    );
    if (!result.committed) {
      const current = result.snapshot.val() as
        | {
            meta?: RoomMeta;
          }
        | null;
      if (current?.meta?.status === "active") return;
      throw new Error("Every contestant must be ready before the race can start.");
    }
    await addEvent("The host started the race", "good").catch(() => undefined);
  }, [addEvent, meta, session]);

  const finishRace = useCallback(
    async (reason: "time" | "host" | "completed") => {
      if (
        !session ||
        session.role === "spectator" ||
        !meta ||
        meta.status !== "active"
      ) {
        return;
      }
      const { database, db } = await getFirebaseContext();
      const now = Date.now() + serverOffsetRef.current;
      const result = await db.runTransaction(
        db.ref(database, `rooms/${session.code}/meta`),
        (current: RoomMeta | null) => finishActiveRace(current, reason, now),
      );
      if (!result.committed) return;
      const activityPath =
        session.role === "host"
          ? `raceActivity/${session.code}/${meta.createdAt}`
          : `raceActivity/${session.code}/${meta.createdAt}/${session.uid}`;
      await db.remove(db.ref(database, activityPath)).catch(() => undefined);
    },
    [meta, session],
  );

  useEffect(() => {
    if (
      !connected ||
      !progressLoaded ||
      !meta ||
      meta.unlimited ||
      meta.status !== "active" ||
      !session ||
      session.role !== "player" ||
      progress.solvedCount < meta.problemCount
    ) {
      return;
    }
    void finishRace("completed").catch(() => undefined);
  }, [
    connected,
    finishRace,
    meta,
    progress.solvedCount,
    progressLoaded,
    session,
  ]);

  const activateWaitingChallenge = useCallback(
    async (startedAt: number) => {
      if (!session || session.role !== "player") return;
      const { database, db } = await getFirebaseContext();
      await db.runTransaction(
        db.ref(database, `rooms/${session.code}/challenge`),
        (current: RoomChallenge | null) => {
          if (
            !current ||
            current.status !== "waiting" ||
            current.championUid !== session.uid
          ) {
            return undefined;
          }
          return { ...current, status: "active", startedAt };
        },
      );
    },
    [session],
  );

  useEffect(() => {
    if (
      !connected ||
      !challenge ||
      challenge.status !== "waiting" ||
      !session ||
      session.role !== "player" ||
      challenge.championUid !== session.uid
    ) {
      return;
    }
    const qualifyingSolveAt = Math.max(0, ...Object.values(progress.solved ?? {}));
    if (qualifyingSolveAt < challenge.createdAt) return;
    void activateWaitingChallenge(qualifyingSolveAt).catch(() => undefined);
  }, [
    activateWaitingChallenge,
    challenge,
    connected,
    progress.solved,
    session,
  ]);

  const recordSolve = useCallback(
    async (problem: Problem, multiplier = 1): Promise<number> => {
      if (!session || session.role !== "player" || meta?.status !== "active") {
        throw new Error("The race is not active.");
      }
      const { database, db } = await getFirebaseContext();
      const { ref, runTransaction, update } = db;
      const progressRef = ref(database, `rooms/${session.code}/progress/${session.uid}`);
      const points = getProblemReward(problem) * (multiplier === DOUBLE_MULTIPLIER ? DOUBLE_MULTIPLIER : 1);
      const now = Date.now() + serverOffsetRef.current;
      const result = await runTransaction(
        progressRef,
        (current: PlayerProgress | null) =>
          solveRaceProblem(current, problem, points, now),
      );
      if (!result.committed) return 0;
      const next = result.snapshot.val() as PlayerProgress;
      await update(
        ref(database, `rooms/${session.code}/leaderboard/${session.uid}`),
        {
          score: next.score,
          correctCount: next.solvedCount,
          lastAcceptedAt: now,
        },
      ).catch(() => undefined);
      await addEvent(
        `${session.nickname} solved ${problem.title} (+${points})`,
        "good",
      ).catch(() => undefined);
      await activateWaitingChallenge(now).catch(() => undefined);
      if (!meta.unlimited && next.solvedCount >= meta.problemCount) {
        await finishRace("completed").catch(() => undefined);
      }
      return points;
    },
    [activateWaitingChallenge, addEvent, finishRace, meta, session],
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
      const result = await runTransaction(
        progressRef,
        (current: PlayerProgress | null) =>
          forfeitRaceProblem(current, problem),
      );
      const next = result.snapshot.val() as PlayerProgress;
      await update(
        ref(database, `rooms/${session.code}/leaderboard/${session.uid}`),
        {
          score: next.score,
        },
      ).catch(() => undefined);
      await addEvent(
        `${session.nickname} forfeited ${problem.title} (-${penalty})`,
        "bad",
      ).catch(() => undefined);
    },
    [addEvent, meta, session],
  );

  const recordMiss = useCallback(
    async (problem: Problem) => {
      if (!session || session.role !== "player" || meta?.status !== "active") return;
      const { database, db } = await getFirebaseContext();
      const progressRef = db.ref(database, `rooms/${session.code}/progress/${session.uid}`);
      await db.runTransaction(
        progressRef,
        (current: PlayerProgress | null) =>
          missRaceProblem(current, problem),
      );
    },
    [meta?.status, session],
  );

  const recordBombExpiry = useCallback(
    async (problem: Problem) => {
      if (!session || session.role !== "player" || meta?.status !== "active") return;
      const { database, db } = await getFirebaseContext();
      const progressRef = db.ref(database, `rooms/${session.code}/progress/${session.uid}`);
      const result = await db.runTransaction(
        progressRef,
        (current: PlayerProgress | null) =>
          expireRaceBomb(current, problem),
      );
      const next = result.snapshot.val() as PlayerProgress;
      await db.update(
        db.ref(database, `rooms/${session.code}/leaderboard/${session.uid}`),
        {
          score: next.score,
        },
      ).catch(() => undefined);
      await addEvent(
        `${session.nickname}'s ${problem.title} speed timer expired (-${BOMB_PENALTY})`,
        "bad",
      ).catch(() => undefined);
    },
    [addEvent, meta?.status, session],
  );

  const requestChallenge = useCallback(
    async (difficulty: Problem["difficulty"]) => {
      if (!session || session.role !== "player" || !meta || meta.status !== "active") {
        throw new Error("Challenges are only available during an active room.");
      }
      if ((progress.currentStreak ?? 0) < 5) {
        throw new Error("Solve five problems in a row before issuing a challenge.");
      }
      const standings = sortRoomPlayers(players);
      const champion = standings[0];
      const challenger = standings.find((player) => player.uid === session.uid);
      if (!champion || !challenger || champion.uid === session.uid) {
        throw new Error("The first-place player cannot challenge themselves.");
      }

      const sourceBank = meta.bankVersion === bank.version ? bank : await loadProblemBank(meta.bankVersion);
      const selectedTopics = parseTopicSelection(meta.topicIds);
      const roomBank = selectedTopics
        ? filterProblemBankByTopics(sourceBank, selectedTopics)
        : sourceBank;
      const { database, db } = await getFirebaseContext();
      const championProgressSnapshot = await db.get(
        db.ref(database, `rooms/${session.code}/progress/${champion.uid}`),
      );
      const championProgress = normalizeProgress(
        championProgressSnapshot.val() as PlayerProgress | null,
      );
      const unavailable = new Set([
        ...Object.keys(progress.solved ?? {}),
        ...Object.keys(championProgress.solved ?? {}),
      ]);
      const candidates = roomBank.problems.filter(
        (problem) => problem.difficulty === difficulty && !unavailable.has(problem.id),
      );
      if (!candidates.length) throw new Error(`No shared unsolved ${difficulty} problem remains.`);
      const problem = candidates[Math.floor(Math.random() * candidates.length)];
      const now = Date.now() + serverOffsetRef.current;
      const nextChallenge: RoomChallenge = {
        id: crypto.randomUUID(),
        status: "waiting",
        challengerUid: challenger.uid,
        challengerName: challenger.nickname,
        championUid: champion.uid,
        championName: champion.nickname,
        difficulty,
        problemId: problem.id,
        problemReward: getProblemReward(problem),
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        winnerUid: null,
      };
      const result = await db.runTransaction(
        db.ref(database, `rooms/${session.code}/challenge`),
        (current: RoomChallenge | null) =>
          current === null ? nextChallenge : undefined,
      );
      if (!result.committed) throw new Error("Another challenge is already pending.");
      await addEvent(
        `${challenger.nickname} challenged leader ${champion.nickname} to a ${difficulty} race`,
        "neutral",
      ).catch(() => undefined);
    },
    [addEvent, bank, meta, players, progress.currentStreak, progress.solved, session],
  );

  const persistChallengeAwards = useCallback(
    async (finishedChallenge: RoomChallenge) => {
      if (
        !session ||
        session.role !== "host" ||
        !finishedChallenge.winnerUid
      ) {
        return;
      }
      const { database, db } = await getFirebaseContext();
      const roomRef = db.ref(database, `rooms/${session.code}`);
      await db.get(roomRef);
      await db.runTransaction(
        roomRef,
        (
          current:
            | (RaceRoomLifecycleState & {
                events?: Record<string, unknown>;
              })
            | null,
        ) => settleCurrentChallengeAwards(current, finishedChallenge),
      );
    },
    [session],
  );

  const recordChallengeSolve = useCallback(
    async (problem: Problem): Promise<number> => {
      if (
        !session ||
        session.role !== "player" ||
        !challenge ||
        challenge.status !== "active"
      ) {
        throw new Error("This challenge is no longer active.");
      }
      const { database, db } = await getFirebaseContext();
      const now = Date.now() + serverOffsetRef.current;
      const result = await db.runTransaction(
        db.ref(database, `rooms/${session.code}/challenge`),
        (current: RoomChallenge | null) => {
          if (
            !current ||
            current.status !== "active" ||
            current.problemId !== problem.id ||
            (current.challengerUid !== session.uid && current.championUid !== session.uid)
          ) {
            return undefined;
          }
          return { ...current, status: "finished", winnerUid: session.uid, finishedAt: now };
        },
      );
      if (!result.committed) throw new Error("The other racer finished first.");
      const finishedChallenge = result.snapshot.val() as RoomChallenge;
      const prize =
        session.uid === finishedChallenge.challengerUid
          ? CHALLENGER_WIN_PRIZE
          : finishedChallenge.problemReward;
      await addEvent(
        `${session.nickname} won the head-to-head challenge (+${prize})`,
        "good",
      ).catch(() => undefined);
      return prize;
    },
    [addEvent, challenge, session],
  );

  useEffect(() => {
    if (
      !connected ||
      !session ||
      session.role !== "host" ||
      !challenge ||
      challenge.status !== "finished" ||
      !challenge.winnerUid
    ) {
      return;
    }
    // The host can update both progress records and both leaderboard
    // projections in one generation-checked room transaction. A participant
    // fallback would require split writes and could leak an old award into a
    // rematch.
    void persistChallengeAwards(challenge).catch(() => undefined);
  }, [challenge, connected, persistChallengeAwards, session]);

  const rematch = useCallback(async () => {
    if (!session || session.role !== "host" || !meta) return;
    const { database, db } = await getFirebaseContext();
    await db.remove(
      db.ref(database, `raceActivity/${session.code}/${meta.createdAt}`),
    );
    const roomRef = db.ref(database, `rooms/${session.code}`);
    await db.get(roomRef);
    const result = await db.runTransaction(
      roomRef,
      (
        current:
          | {
              meta: RoomMeta;
              leaderboard?: Record<string, RoomPlayer>;
              spectators?: Record<string, RoomSpectator>;
              progress?: Record<string, PlayerProgress>;
              challenge?: RoomChallenge;
              events?: Record<string, unknown>;
            }
          | null,
      ) => resetRaceForRematch(current),
    );
    if (!result.committed) {
      throw new Error(
        "The final challenge result is still being saved. Try the rematch again in a moment.",
      );
    }
  }, [meta, session]);

  const leaveRoom = useCallback(async () => {
    const current = session;
    saveSession(null);
    setMeta(null);
    setPlayers([]);
    setSpectators([]);
    setActivities({});
    setActivityError(null);
    setProgress(createRaceProgress());
    setProgressLoaded(false);
    setEvents([]);
    setChallenge(null);
    setChallengeLoadedFor(null);
    if (!current || !isFirebaseConfigured) return;
    const { database, db } = await getFirebaseContext();
    const { ref, remove, set } = db;
    if (current.role === "player") {
      if (meta?.status === "active" && meta.createdAt) {
        await remove(
          ref(
            database,
            `raceActivity/${current.code}/${meta.createdAt}/${current.uid}`,
          ),
        ).catch(() => undefined);
      }
      if (meta?.status === "lobby") {
        await remove(ref(database, `rooms/${current.code}/leaderboard/${current.uid}`));
        await remove(ref(database, `rooms/${current.code}/progress/${current.uid}`));
      } else {
        await set(ref(database, `rooms/${current.code}/leaderboard/${current.uid}/online`), false);
      }
    } else if (current.role === "spectator") {
      await remove(
        ref(database, `rooms/${current.code}/spectators/${current.uid}`),
      ).catch(() => undefined);
    }
  }, [meta, saveSession, session]);

  const closeRoom = useCallback(async () => {
    if (!session || session.role !== "host" || !meta) return;
    const { database, db } = await getFirebaseContext();
    await db.remove(
      db.ref(database, `raceActivity/${session.code}/${meta.createdAt}`),
    );
    const roomRef = db.ref(database, `rooms/${session.code}`);
    await db.get(roomRef);
    const result = await db.runTransaction(
      roomRef,
      (
        current:
          | (RaceRoomLifecycleState & {
              events?: Record<string, unknown>;
            })
          | null,
      ) => closeRaceRoomIfChallengeSettled(current),
    );
    if (!result.committed) {
      throw new Error(
        "The final challenge result is still being saved. Try closing the room again in a moment.",
      );
    }
    saveSession(null);
  }, [meta, saveSession, session]);

  const sortedPlayers = useMemo(() => sortRoomPlayers(players), [players]);

  return {
    configured: isFirebaseConfigured,
    authUser,
    authLoading,
    signIn,
    signOut,
    connected,
    session,
    meta,
    players: sortedPlayers,
    spectators,
    activities,
    activityError,
    progress,
    challenge,
    challengeLoaded,
    events,
    loading,
    error,
    serverNow: () => Date.now() + serverOffsetRef.current,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    setReady,
    publishActivity,
    makeSpectator,
    makePlayer,
    setDuration,
    setUnlimited,
    startRace,
    finishRace,
    recordSolve,
    recordForfeit,
    recordMiss,
    recordBombExpiry,
    requestChallenge,
    recordChallengeSolve,
    rematch,
  };
}
