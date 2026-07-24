import { describe, expect, it } from "vitest";
import type { Problem } from "../data/problemTypes";
import type {
  RoomChallenge,
  RoomMeta,
  RoomPlayer,
} from "../types/multiplayer";
import {
  closeRaceRoomIfChallengeSettled,
  createRaceProgress,
  expireRaceBomb,
  finishActiveRace,
  forfeitRaceProblem,
  missRaceProblem,
  moveRacePlayerToSpectators,
  moveRaceSpectatorToPlayers,
  resetRaceForRematch,
  settleCurrentChallengeAwards,
  type RaceRoomLifecycleState,
  solveRaceProblem,
  startReadyRace,
} from "./raceRoomLifecycle";

const NOW = 1_800_000_000_000;

function player(uid: string, ready = true): RoomPlayer {
  return {
    uid,
    nickname: uid,
    normalizedNickname: uid.toLowerCase(),
    score: 0,
    correctCount: 0,
    joinedAt: NOW - 1_000,
    lastAcceptedAt: null,
    online: true,
    ready,
  };
}

function meta(overrides: Partial<RoomMeta> = {}): RoomMeta {
  return {
    hostUid: "host",
    hostOnline: true,
    status: "lobby",
    bankVersion: "v5",
    problemCount: 10,
    durationSeconds: 90,
    unlimited: false,
    createdAt: NOW - 5_000,
    startedAt: null,
    endsAt: null,
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

function problem(id: string, difficulty: Problem["difficulty"] = "easy"): Problem {
  return {
    id,
    title: id,
    difficulty,
    tags: ["test"],
    description: "test",
    starterCode: "",
    solutionCode: "",
    testCases: [{ input: "", expectedOutput: "" }],
  };
}

function finishedChallenge(
  overrides: Partial<RoomChallenge> = {},
): RoomChallenge {
  return {
    id: "duel",
    status: "finished",
    challengerUid: "ada",
    challengerName: "Ada",
    championUid: "grace",
    championName: "Grace",
    difficulty: "medium",
    problemId: "medium-1",
    problemReward: 300,
    createdAt: NOW - 5_000,
    startedAt: NOW - 4_000,
    finishedAt: NOW - 3_000,
    winnerUid: "ada",
    ...overrides,
  };
}

describe("competitive room lifecycle", () => {
  it("starts exactly when at least one contestant is ready", () => {
    const lobby = {
      meta: meta(),
      leaderboard: {
        ada: player("Ada"),
        grace: player("Grace"),
      },
      untouched: "room data",
    };

    expect(startReadyRace(lobby, NOW)).toEqual({
      ...lobby,
      meta: {
        ...lobby.meta,
        status: "active",
        startedAt: NOW,
        endsAt: NOW + 90_000,
      },
    });
    expect(startReadyRace({ ...lobby, leaderboard: {} }, NOW)).toBeUndefined();
    expect(
      startReadyRace(
        {
          ...lobby,
          leaderboard: {
            ada: player("Ada"),
            grace: player("Grace", false),
          },
        },
        NOW,
      ),
    ).toBeUndefined();
  });

  it("does not restart an active or finished race when a delayed start arrives", () => {
    expect(
      startReadyRace(
        {
          meta: meta({
            status: "active",
            startedAt: NOW - 10_000,
            endsAt: NOW + 80_000,
          }),
          leaderboard: { ada: player("Ada") },
        },
        NOW,
      ),
    ).toBeUndefined();
    expect(
      startReadyRace(
        {
          meta: meta({ status: "finished", endedAt: NOW - 1, endReason: "host" }),
          leaderboard: { ada: player("Ada") },
        },
        NOW,
      ),
    ).toBeUndefined();
  });

  it("starts unlimited races without a deadline", () => {
    const started = startReadyRace(
      {
        meta: meta({ unlimited: true }),
        leaderboard: { ada: player("Ada") },
      },
      NOW,
    );

    expect(started?.meta.endsAt).toBeNull();
    expect(started?.meta.startedAt).toBe(NOW);
  });

  it("finishes an active race once and ignores stale expiry callbacks", () => {
    const active = meta({
      status: "active",
      startedAt: NOW - 10_000,
      endsAt: NOW + 80_000,
    });
    const finished = finishActiveRace(active, "host", NOW);

    expect(finished).toEqual({
      ...active,
      status: "finished",
      endedAt: NOW,
      endReason: "host",
    });
    expect(finishActiveRace(finished!, "time", NOW + 5_000)).toBeUndefined();
    expect(finishActiveRace(meta(), "time", NOW)).toBeUndefined();
  });

  it("simulates solves, misses, forfeits, and bomb expiry without corrupting progress", () => {
    let progress = createRaceProgress();
    for (let index = 0; index < 5; index += 1) {
      progress = solveRaceProblem(
        progress,
        problem(`easy-${index}`),
        100,
        NOW + index,
      )!;
    }

    expect(progress).toMatchObject({
      score: 500,
      solvedCount: 5,
      currentStreak: 5,
    });
    expect(
      solveRaceProblem(progress, problem("easy-4"), 100, NOW + 100),
    ).toBeUndefined();

    progress = missRaceProblem(progress, problem("medium-miss", "medium"));
    expect(progress.score).toBe(500);
    expect(progress.currentStreak).toBe(0);
    expect(progress.adaptive?.medium.missed).toBe(1);

    progress = forfeitRaceProblem(progress, problem("hard-forfeit", "hard"));
    expect(progress.score).toBe(450);
    expect(progress.solvedCount).toBe(5);
    expect(progress.adaptive?.hard.forfeited).toBe(1);

    progress = expireRaceBomb(progress, problem("bomb"));
    expect(progress.score).toBe(400);
    expect(progress.solvedCount).toBe(5);
    expect(progress.adaptive?.easy.forfeited).toBe(1);
  });

  it("returns independent fresh progress records for promotions and rematches", () => {
    const first = createRaceProgress();
    const second = createRaceProgress();

    first.solved.example = NOW;
    first.challengeAwards!.duel = 1_000;

    expect(second).toEqual(createRaceProgress());
    expect(second.solved).not.toHaveProperty("example");
    expect(second.challengeAwards).not.toHaveProperty("duel");
  });

  it("atomically demotes contestants and finishes when concurrent removals reach zero", () => {
    const activeMeta = meta({
      status: "active",
      startedAt: NOW - 10_000,
      endsAt: NOW + 80_000,
    });
    const room: RaceRoomLifecycleState = {
      meta: activeMeta,
      leaderboard: {
        ada: player("ada"),
        grace: player("grace"),
      },
      progress: {
        ada: createRaceProgress(),
        grace: createRaceProgress(),
      },
    };

    const oneLeft = moveRacePlayerToSpectators(room, "ada", NOW)!;
    expect(oneLeft.meta.status).toBe("active");
    expect(Object.keys(oneLeft.leaderboard ?? {})).toEqual(["grace"]);
    expect(oneLeft.progress).not.toHaveProperty("ada");
    expect(oneLeft.spectators?.ada.nickname).toBe("ada");

    const noneLeft = moveRacePlayerToSpectators(oneLeft, "grace", NOW + 1)!;
    expect(noneLeft.meta.status).toBe("finished");
    expect(noneLeft.meta.endReason).toBe("host");
    expect(noneLeft.leaderboard).toEqual({});
  });

  it("retires live and settled challenges during participant demotion", () => {
    const activeChallenge = {
      id: "duel",
      status: "active" as const,
      challengerUid: "ada",
      challengerName: "ada",
      championUid: "grace",
      championName: "grace",
      difficulty: "easy" as const,
      problemId: "easy-1",
      problemReward: 100,
      createdAt: NOW - 2_000,
      startedAt: NOW - 1_000,
      finishedAt: null,
      winnerUid: null,
    };
    const room: RaceRoomLifecycleState = {
      meta: meta({ status: "active" }),
      leaderboard: { ada: player("ada"), grace: player("grace") },
      progress: { ada: createRaceProgress(), grace: createRaceProgress() },
      challenge: activeChallenge,
    };

    const cancelled = moveRacePlayerToSpectators(room, "ada", NOW)!;
    expect(cancelled.challenge).toBeUndefined();

    const alreadyFinished = {
      ...room,
      challenge: {
        ...activeChallenge,
        status: "finished" as const,
        winnerUid: "ada",
        finishedAt: NOW - 10,
      },
    };
    expect(
      moveRacePlayerToSpectators(alreadyFinished, "ada", NOW)!.challenge,
    ).toBeUndefined();
  });

  it("preserves remaining challenge awards for both settlement-demotion orders", () => {
    const challenge = finishedChallenge();
    const room: RaceRoomLifecycleState = {
      meta: meta({ status: "active" }),
      challenge,
      leaderboard: {
        ada: { ...player("ada"), score: 250 },
        grace: { ...player("grace"), score: 500 },
      },
      progress: {
        ada: { ...createRaceProgress(), score: 250 },
        grace: { ...createRaceProgress(), score: 500 },
      },
    };

    const settledFirst = settleCurrentChallengeAwards(room, challenge)!;
    const demotedAfterSettlement = moveRacePlayerToSpectators(
      settledFirst,
      "grace",
      NOW,
    )!;
    expect(demotedAfterSettlement.progress?.ada).toMatchObject({
      score: 1_250,
      challengeAwards: { duel: 1_000 },
    });
    expect(demotedAfterSettlement.leaderboard?.ada.score).toBe(1_250);

    const demotedFirst = moveRacePlayerToSpectators(
      room,
      "grace",
      NOW,
    )!;
    expect(demotedFirst.progress?.ada).toMatchObject({
      score: 1_250,
      challengeAwards: { duel: 1_000 },
    });
    expect(demotedFirst.leaderboard?.ada.score).toBe(1_250);
    expect(
      settleCurrentChallengeAwards(demotedFirst, challenge),
    ).toBeUndefined();
    expect(demotedFirst.challenge).toBeUndefined();
    expect(demotedFirst.progress).not.toHaveProperty("grace");
    expect(demotedFirst.leaderboard).not.toHaveProperty("grace");

    const promotedAgain = moveRaceSpectatorToPlayers(
      demotedFirst,
      "grace",
    )!;
    expect(promotedAgain.progress?.grace).toEqual(createRaceProgress());
    expect(
      settleCurrentChallengeAwards(promotedAgain, challenge),
    ).toBeUndefined();
    expect(promotedAgain.progress?.ada).toMatchObject({
      score: 1_250,
      challengeAwards: { duel: 1_000 },
    });
    expect(promotedAgain.progress?.grace).toEqual(createRaceProgress());
  });

  it("promotes only a current spectator with a fresh progress record", () => {
    const spectator = {
      uid: "ada",
      nickname: "Ada",
      normalizedNickname: "ada",
      joinedAt: NOW - 5_000,
      assignedAt: NOW - 1_000,
      online: true,
    };
    const room: RaceRoomLifecycleState = {
      meta: meta(),
      leaderboard: { grace: player("grace") },
      progress: { grace: createRaceProgress() },
      spectators: { ada: spectator },
    };

    const promoted = moveRaceSpectatorToPlayers(room, "ada")!;
    expect(promoted.spectators).toEqual({});
    expect(promoted.leaderboard?.ada).toMatchObject({
      nickname: "Ada",
      score: 0,
      correctCount: 0,
      ready: false,
    });
    expect(promoted.progress?.ada).toEqual(createRaceProgress());
    expect(moveRaceSpectatorToPlayers(promoted, "ada")).toBeUndefined();
    expect(
      moveRaceSpectatorToPlayers(
        { ...room, meta: meta({ status: "finished" }) },
        "ada",
      ),
    ).toBeUndefined();
  });

  it("settles both challenge awards and leaderboard projections atomically", () => {
    const challenge = finishedChallenge();
    const room: RaceRoomLifecycleState = {
      meta: meta({ status: "active" }),
      challenge,
      leaderboard: {
        ada: { ...player("ada"), score: 250 },
        grace: { ...player("grace"), score: 500 },
      },
      progress: {
        ada: { ...createRaceProgress(), score: 250 },
        grace: { ...createRaceProgress(), score: 500 },
      },
    };

    const settled = settleCurrentChallengeAwards(room, challenge)!;

    expect(settled.progress?.ada).toMatchObject({
      score: 1_250,
      challengeAwards: { duel: 1_000 },
    });
    expect(settled.progress?.grace).toMatchObject({
      score: 500,
      challengeAwards: { duel: 0 },
    });
    expect(settled.leaderboard?.ada.score).toBe(1_250);
    expect(settled.leaderboard?.grace.score).toBe(500);
    expect(settled.challenge).toBeUndefined();
    expect(room.progress?.ada.score).toBe(250);
    expect(room.leaderboard?.ada.score).toBe(250);
  });

  it("retries challenge settlement without reapplying awards and repairs projections", () => {
    const challenge = finishedChallenge();
    const legacyPartiallySettledRoom: RaceRoomLifecycleState = {
      meta: meta({ status: "active" }),
      challenge,
      leaderboard: {
        ada: { ...player("ada"), score: 0 },
        grace: { ...player("grace"), score: 500 },
      },
      progress: {
        ada: {
          ...createRaceProgress(),
          score: 1_250,
          challengeAwards: { duel: 1_000 },
        },
        grace: {
          ...createRaceProgress(),
          score: 500,
          challengeAwards: { duel: 0 },
        },
      },
    };

    const repaired = settleCurrentChallengeAwards(
      legacyPartiallySettledRoom,
      challenge,
    )!;
    expect(repaired.progress?.ada.score).toBe(1_250);
    expect(repaired.progress?.ada.challengeAwards).toEqual({ duel: 1_000 });
    expect(repaired.leaderboard?.ada.score).toBe(1_250);
    expect(repaired.challenge).toBeUndefined();
    expect(
      settleCurrentChallengeAwards(repaired, challenge),
    ).toBeUndefined();
  });

  it("blocks rematch until a finished challenge is settled", () => {
    const challenge = finishedChallenge();
    const finishedRoom: RaceRoomLifecycleState = {
      meta: meta({
        status: "finished",
        endedAt: NOW,
        endReason: "time",
      }),
      challenge,
      leaderboard: {
        ada: { ...player("ada"), score: 250 },
        grace: { ...player("grace"), score: 500 },
      },
      progress: {
        ada: { ...createRaceProgress(), score: 250 },
        grace: { ...createRaceProgress(), score: 500 },
      },
    };

    expect(resetRaceForRematch(finishedRoom)).toBeUndefined();
    expect(finishedRoom.progress?.ada.score).toBe(250);

    const settled = settleCurrentChallengeAwards(
      finishedRoom,
      challenge,
    )!;
    expect(settled.progress?.ada.score).toBe(1_250);
    expect(resetRaceForRematch(settled)?.progress?.ada.score).toBe(0);

    const replaced = {
      ...finishedRoom,
      meta: meta({ status: "active" }),
      challenge: finishedChallenge({
        id: "next-duel",
        createdAt: NOW + 1,
      }),
    };
    expect(
      settleCurrentChallengeAwards(replaced, challenge),
    ).toBeUndefined();

    const changedWinner = {
      ...finishedRoom,
      meta: meta({ status: "active" }),
      challenge: finishedChallenge({ winnerUid: "grace" }),
    };
    expect(
      settleCurrentChallengeAwards(changedWinner, challenge),
    ).toBeUndefined();
  });

  it("blocks close on an unseen finished winner but allows non-winning challenge states", () => {
    const base: RaceRoomLifecycleState = {
      meta: meta({
        status: "finished",
        endedAt: NOW,
        endReason: "time",
      }),
      leaderboard: {
        ada: player("ada"),
        grace: player("grace"),
      },
      progress: {
        ada: createRaceProgress(),
        grace: createRaceProgress(),
      },
    };
    const stalePrefetchedRoom = base;
    const freshFinishedRoom = {
      ...base,
      challenge: finishedChallenge(),
    };

    expect(closeRaceRoomIfChallengeSettled(stalePrefetchedRoom)).toBeNull();
    expect(
      closeRaceRoomIfChallengeSettled(freshFinishedRoom),
    ).toBeUndefined();
    expect(
      closeRaceRoomIfChallengeSettled({
        ...base,
        challenge: {
          ...finishedChallenge(),
          status: "active",
          finishedAt: null,
          winnerUid: null,
        },
      }),
    ).toBeNull();
    expect(
      resetRaceForRematch({
        ...base,
        challenge: {
          ...finishedChallenge(),
          status: "active",
          finishedAt: null,
          winnerUid: null,
        },
      })?.meta.status,
    ).toBe("lobby");
    expect(
      closeRaceRoomIfChallengeSettled({
        ...base,
        challenge: finishedChallenge({ winnerUid: null }),
      }),
    ).toBeNull();
  });

  it("keeps rematch scores clean when settlement wins the interleaving first", () => {
    const challenge = finishedChallenge();
    const room: RaceRoomLifecycleState = {
      meta: meta({
        status: "finished",
        endedAt: NOW,
        endReason: "time",
      }),
      challenge,
      leaderboard: {
        ada: { ...player("ada"), score: 250 },
        grace: { ...player("grace"), score: 500 },
      },
      progress: {
        ada: { ...createRaceProgress(), score: 250 },
        grace: { ...createRaceProgress(), score: 500 },
      },
    };

    const settled = settleCurrentChallengeAwards(room, challenge)!;
    const rematched = resetRaceForRematch(settled)!;

    expect(rematched.challenge).toBeUndefined();
    expect(rematched.progress?.ada).toEqual(createRaceProgress());
    expect(rematched.progress?.grace).toEqual(createRaceProgress());
    expect(rematched.leaderboard?.ada.score).toBe(0);
    expect(rematched.leaderboard?.grace.score).toBe(0);
  });

  it("resets a finished race once without letting a delayed second rematch clear readiness", () => {
    const room: RaceRoomLifecycleState & { events?: Record<string, unknown> } = {
      meta: meta({
        status: "finished",
        startedAt: NOW - 10_000,
        endsAt: NOW - 1,
        endedAt: NOW,
        endReason: "time",
      }),
      leaderboard: {
        ada: {
          ...player("ada"),
          score: 500,
          correctCount: 5,
          lastAcceptedAt: NOW - 1,
        },
      },
      progress: {
        ada: {
          ...createRaceProgress(),
          score: 500,
          solvedCount: 5,
          solved: { one: NOW - 1 },
        },
      },
      challenge: {
        id: "duel",
        status: "finished",
        challengerUid: "ada",
        challengerName: "ada",
        championUid: "grace",
        championName: "grace",
        difficulty: "easy",
        problemId: "one",
        problemReward: 100,
        createdAt: NOW - 5,
        startedAt: NOW - 4,
        finishedAt: NOW - 3,
        winnerUid: null,
      },
      events: { event: { message: "finished" } },
    };

    const lobby = resetRaceForRematch(room)!;
    expect(lobby.meta).toMatchObject({
      status: "lobby",
      startedAt: null,
      endsAt: null,
      endedAt: null,
      endReason: null,
    });
    expect(lobby.leaderboard?.ada).toMatchObject({
      score: 0,
      correctCount: 0,
      lastAcceptedAt: null,
      ready: false,
    });
    expect(lobby.progress?.ada).toEqual(createRaceProgress());
    expect(lobby.challenge).toBeUndefined();
    expect(lobby.events).toBeUndefined();
    expect(resetRaceForRematch(lobby)).toBeUndefined();
  });
});
