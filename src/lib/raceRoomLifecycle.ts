import {
  createAdaptiveProfiles,
  normalizeAdaptiveProfile,
  updateAdaptiveProfile,
} from "../data/adaptiveLearning";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import type { Problem } from "../data/problemTypes";
import { BOMB_PENALTY } from "../data/timedProblems";
import type {
  PlayerProgress,
  RoomChallenge,
  RoomEndReason,
  RoomMeta,
  RoomPlayer,
  RoomSpectator,
} from "../types/multiplayer";
import { applyChallengeAward } from "./challengeLogic";

export interface RaceRoomLifecycleState {
  meta: RoomMeta;
  leaderboard?: Record<string, RoomPlayer>;
  spectators?: Record<string, RoomSpectator>;
  progress?: Record<string, PlayerProgress>;
  challenge?: RoomChallenge;
}

export function hasPendingChallengeSettlement(
  room: RaceRoomLifecycleState | null,
): boolean {
  return Boolean(
    room?.challenge?.status === "finished" &&
      room.challenge.winnerUid,
  );
}

export function closeRaceRoomIfChallengeSettled(
  room: RaceRoomLifecycleState | null,
): null | undefined {
  if (!room || hasPendingChallengeSettlement(room)) return undefined;
  return null;
}

export function createRaceProgress(): PlayerProgress {
  return {
    score: 0,
    solvedCount: 0,
    currentStreak: 0,
    solved: {},
    adaptive: createAdaptiveProfiles(),
    challengeAwards: {},
  };
}

export function normalizeRaceProgress(
  value: PlayerProgress | null,
): PlayerProgress {
  const progress = value ?? createRaceProgress();
  return {
    ...progress,
    score: Number(progress.score) || 0,
    solvedCount: Math.max(0, Number(progress.solvedCount) || 0),
    currentStreak: Math.max(0, Number(progress.currentStreak) || 0),
    solved: progress.solved ?? {},
    challengeAwards: progress.challengeAwards ?? {},
    adaptive: {
      easy: normalizeAdaptiveProfile(progress.adaptive?.easy),
      medium: normalizeAdaptiveProfile(progress.adaptive?.medium),
      hard: normalizeAdaptiveProfile(progress.adaptive?.hard),
    },
  };
}

export function solveRaceProblem(
  current: PlayerProgress | null,
  problem: Problem,
  points: number,
  solvedAt: number,
): PlayerProgress | undefined {
  const progress = normalizeRaceProgress(current);
  if (progress.solved[problem.id] !== undefined) return undefined;
  return {
    ...progress,
    score: progress.score + points,
    solvedCount: progress.solvedCount + 1,
    currentStreak: (progress.currentStreak ?? 0) + 1,
    solved: { ...progress.solved, [problem.id]: solvedAt },
    adaptive: {
      ...progress.adaptive!,
      [problem.difficulty]: updateAdaptiveProfile(
        progress.adaptive?.[problem.difficulty],
        "solved",
      ),
    },
  };
}

export function forfeitRaceProblem(
  current: PlayerProgress | null,
  problem: Problem,
): PlayerProgress {
  const progress = normalizeRaceProgress(current);
  return {
    ...progress,
    score: progress.score - DIFFICULTY_CONFIG[problem.difficulty].penalty,
    currentStreak: 0,
    adaptive: {
      ...progress.adaptive!,
      [problem.difficulty]: updateAdaptiveProfile(
        progress.adaptive?.[problem.difficulty],
        "forfeited",
      ),
    },
  };
}

export function missRaceProblem(
  current: PlayerProgress | null,
  problem: Problem,
): PlayerProgress {
  const progress = normalizeRaceProgress(current);
  return {
    ...progress,
    currentStreak: 0,
    adaptive: {
      ...progress.adaptive!,
      [problem.difficulty]: updateAdaptiveProfile(
        progress.adaptive?.[problem.difficulty],
        "missed",
      ),
    },
  };
}

export function expireRaceBomb(
  current: PlayerProgress | null,
  problem: Problem,
): PlayerProgress {
  const progress = normalizeRaceProgress(current);
  return {
    ...progress,
    score: progress.score - BOMB_PENALTY,
    currentStreak: 0,
    adaptive: {
      ...progress.adaptive!,
      [problem.difficulty]: updateAdaptiveProfile(
        progress.adaptive?.[problem.difficulty],
        "forfeited",
      ),
    },
  };
}

export function startReadyRace<T extends RaceRoomLifecycleState>(
  room: T | null,
  now: number,
): T | undefined {
  if (!room || room.meta.status !== "lobby") return undefined;
  const contestants = Object.values(room.leaderboard ?? {});
  if (!contestants.length || contestants.some((player) => !player.ready)) {
    return undefined;
  }
  return {
    ...room,
    meta: {
      ...room.meta,
      status: "active",
      startedAt: now,
      endsAt: room.meta.unlimited ? null : now + room.meta.durationSeconds * 1000,
      endedAt: null,
      endReason: null,
    },
  };
}

export function finishActiveRace(
  meta: RoomMeta | null,
  reason: Exclude<RoomEndReason, null>,
  now: number,
): RoomMeta | undefined {
  if (!meta || meta.status !== "active") return undefined;
  return {
    ...meta,
    status: "finished",
    endedAt: now,
    endReason: reason,
  };
}

export function moveRacePlayerToSpectators<T extends RaceRoomLifecycleState>(
  room: T | null,
  uid: string,
  assignedAt: number,
): T | undefined {
  if (!room) return undefined;
  const settledRoom =
    room.challenge?.status === "finished" && room.challenge.winnerUid
      ? settleCurrentChallengeAwards(room, room.challenge) ?? room
      : room;
  const player = settledRoom.leaderboard?.[uid];
  if (!player) return undefined;

  const leaderboard = { ...(settledRoom.leaderboard ?? {}) };
  const progress = { ...(settledRoom.progress ?? {}) };
  delete leaderboard[uid];
  delete progress[uid];

  const shouldRetireChallenge = Boolean(
    settledRoom.challenge &&
      (settledRoom.challenge.challengerUid === uid ||
        settledRoom.challenge.championUid === uid),
  );
  const shouldFinish =
    settledRoom.meta.status === "active" &&
    Object.keys(leaderboard).length === 0;

  const next = {
    ...settledRoom,
    meta: shouldFinish
      ? finishActiveRace(settledRoom.meta, "host", assignedAt)!
      : settledRoom.meta,
    leaderboard,
    progress,
    spectators: {
      ...(settledRoom.spectators ?? {}),
      [uid]: {
        uid: player.uid,
        nickname: player.nickname,
        normalizedNickname: player.normalizedNickname,
        joinedAt: player.joinedAt,
        assignedAt,
        online: player.online,
      },
    },
  };
  if (shouldRetireChallenge) delete next.challenge;
  return next;
}

export function moveRaceSpectatorToPlayers<T extends RaceRoomLifecycleState>(
  room: T | null,
  uid: string,
): T | undefined {
  const spectator = room?.spectators?.[uid];
  if (!room || !spectator || room.meta.status === "finished") return undefined;

  const spectators = { ...(room.spectators ?? {}) };
  delete spectators[uid];

  return {
    ...room,
    leaderboard: {
      ...(room.leaderboard ?? {}),
      [uid]: {
        uid: spectator.uid,
        nickname: spectator.nickname,
        normalizedNickname: spectator.normalizedNickname,
        score: 0,
        correctCount: 0,
        joinedAt: spectator.joinedAt,
        lastAcceptedAt: null,
        online: spectator.online,
        ready: false,
      },
    },
    progress: {
      ...(room.progress ?? {}),
      [uid]: createRaceProgress(),
    },
    spectators,
  };
}

export function settleCurrentChallengeAwards<
  T extends RaceRoomLifecycleState,
>(
  room: T | null,
  expectedChallenge: RoomChallenge,
): T | undefined {
  const challenge = room?.challenge;
  if (
    !room ||
    room.meta.status === "lobby" ||
    !challenge ||
    expectedChallenge.status !== "finished" ||
    !expectedChallenge.winnerUid ||
    challenge.status !== "finished" ||
    challenge.id !== expectedChallenge.id ||
    challenge.createdAt !== expectedChallenge.createdAt ||
    challenge.challengerUid !== expectedChallenge.challengerUid ||
    challenge.championUid !== expectedChallenge.championUid ||
    challenge.problemId !== expectedChallenge.problemId ||
    challenge.problemReward !== expectedChallenge.problemReward ||
    challenge.winnerUid !== expectedChallenge.winnerUid
  ) {
    return undefined;
  }

  const participantUids = [
    challenge.challengerUid,
    challenge.championUid,
  ] as const;
  if (
    participantUids[0] === participantUids[1] ||
    participantUids.some(
      (uid) => !room.progress?.[uid] || !room.leaderboard?.[uid],
    )
  ) {
    return undefined;
  }

  const progress = { ...room.progress };
  const leaderboard = { ...room.leaderboard };
  let changed = false;

  for (const uid of participantUids) {
    const currentProgress = normalizeRaceProgress(progress[uid]);
    const awardedProgress = applyChallengeAward(
      currentProgress,
      challenge,
      uid,
    );
    const nextProgress = awardedProgress ?? currentProgress;
    if (awardedProgress) {
      progress[uid] = awardedProgress;
      changed = true;
    }
    if (leaderboard[uid].score !== nextProgress.score) {
      leaderboard[uid] = {
        ...leaderboard[uid],
        score: nextProgress.score,
      };
      changed = true;
    }
  }

  const next = changed
    ? {
        ...room,
        progress,
        leaderboard,
      }
    : { ...room };
  // A finished challenge is a pending settlement record. Retiring it in the
  // same commit makes the empty slot the only signal that a new challenge may
  // be created.
  delete next.challenge;
  return next;
}

export function resetRaceForRematch<T extends RaceRoomLifecycleState>(
  room: T | null,
): T | undefined {
  if (
    !room ||
    room.meta.status !== "finished" ||
    hasPendingChallengeSettlement(room)
  ) {
    return undefined;
  }

  const leaderboard = Object.fromEntries(
    Object.entries(room.leaderboard ?? {}).map(([uid, player]) => [
      uid,
      {
        ...player,
        score: 0,
        correctCount: 0,
        lastAcceptedAt: null,
        ready: false,
      },
    ]),
  );
  const progress = Object.fromEntries(
    Object.keys(leaderboard).map((uid) => [uid, createRaceProgress()]),
  );
  const next = {
    ...room,
    meta: {
      ...room.meta,
      status: "lobby" as const,
      startedAt: null,
      endsAt: null,
      endedAt: null,
      endReason: null,
    },
    leaderboard,
    progress,
  };
  delete next.challenge;
  delete (next as T & { events?: unknown }).events;
  return next;
}
