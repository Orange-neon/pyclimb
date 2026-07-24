import { describe, expect, it } from "vitest";
import type { RoomChallenge } from "../types/multiplayer";
import {
  applyChallengeAward,
  assertChallengeStateLoaded,
  canIssueLeaderChallenge,
  CHALLENGER_WIN_PRIZE,
  getChallengeScoreDelta,
  isChallengeSelectionBlocked,
  shouldClearChallengeDraft,
} from "./challengeLogic";

const challenge: RoomChallenge = {
  id: "duel",
  status: "finished",
  challengerUid: "challenger",
  challengerName: "Challenger",
  championUid: "champion",
  championName: "Champion",
  difficulty: "medium",
  problemId: "problem",
  problemReward: 550,
  createdAt: 1,
  startedAt: 2,
  finishedAt: 3,
  winnerUid: "challenger",
};

describe("leader challenges", () => {
  it("requires five consecutive solves and a non-leading challenger", () => {
    expect(canIssueLeaderChallenge(5, 2, 3)).toBe(true);
    expect(canIssueLeaderChallenge(4, 2, 3)).toBe(false);
    expect(canIssueLeaderChallenge(5, 1, 3)).toBe(false);
    expect(canIssueLeaderChallenge(5, 2, 1)).toBe(false);
    expect(canIssueLeaderChallenge(5, 2, 3, "active")).toBe(false);
    expect(canIssueLeaderChallenge(5, 2, 3, "finished")).toBe(false);
    expect(canIssueLeaderChallenge(5, 2, 3, undefined, true)).toBe(false);
  });

  it("keeps a waiting challenger's draft empty without blocking the champion's gate problem", () => {
    const waiting = {
      ...challenge,
      status: "waiting" as const,
      winnerUid: null,
      startedAt: null,
      finishedAt: null,
    };

    expect(isChallengeSelectionBlocked(waiting, "challenger")).toBe(true);
    expect(isChallengeSelectionBlocked(waiting, "champion")).toBe(false);
    expect(
      isChallengeSelectionBlocked({ ...waiting, status: "active" }, "champion"),
    ).toBe(true);
    expect(
      isChallengeSelectionBlocked({ ...waiting, status: "active" }, "observer"),
    ).toBe(false);
    expect(isChallengeSelectionBlocked(null, "challenger")).toBe(false);
    expect(isChallengeSelectionBlocked(null, "challenger", false)).toBe(true);
  });

  it("blocks score-sensitive interactions until challenge state is authoritative", () => {
    expect(() => assertChallengeStateLoaded(true)).not.toThrow();
    expect(() => assertChallengeStateLoaded(false)).toThrow(
      "Room challenge state is still syncing",
    );
  });

  it("clears persisted challenge drafts unless the same duel is still active", () => {
    const active = {
      ...challenge,
      status: "active" as const,
      winnerUid: null,
      finishedAt: null,
    };

    expect(
      shouldClearChallengeDraft(active.id, null, "challenger", false),
    ).toBe(false);
    expect(
      shouldClearChallengeDraft(active.id, null, "challenger", true),
    ).toBe(true);
    expect(
      shouldClearChallengeDraft(null, null, "challenger", true),
    ).toBe(false);
    expect(
      shouldClearChallengeDraft(active.id, active, "challenger", true),
    ).toBe(false);
    expect(
      shouldClearChallengeDraft(active.id, active, "champion", true),
    ).toBe(false);
    expect(
      shouldClearChallengeDraft(active.id, null, "challenger", true),
    ).toBe(true);
    expect(
      shouldClearChallengeDraft(
        active.id,
        { ...active, id: "replacement" },
        "challenger",
        true,
      ),
    ).toBe(true);
    expect(
      shouldClearChallengeDraft(
        active.id,
        { ...active, status: "finished" },
        "challenger",
        true,
      ),
    ).toBe(true);
    expect(
      shouldClearChallengeDraft(active.id, active, "observer", true),
    ).toBe(true);
  });

  it("awards a challenger winner exactly 1000 points", () => {
    expect(getChallengeScoreDelta(challenge, "challenger", 550)).toBe(CHALLENGER_WIN_PRIZE);
    expect(getChallengeScoreDelta(challenge, "champion", 550)).toBe(0);
  });

  it("transfers the full problem reward when the champion wins", () => {
    const championWin = { ...challenge, winnerUid: "champion" };
    expect(getChallengeScoreDelta(championWin, "challenger", 550)).toBe(-550);
    expect(getChallengeScoreDelta(championWin, "champion", 550)).toBe(550);
  });

  it("applies both sides of a finished challenge exactly once", () => {
    const base = {
      score: 500,
      solvedCount: 5,
      solved: {},
      challengeAwards: {},
    };
    const challenger = applyChallengeAward(base, challenge, "challenger");
    const champion = applyChallengeAward(base, challenge, "champion");

    expect(challenger?.score).toBe(1_500);
    expect(challenger?.challengeAwards).toEqual({ duel: 1_000 });
    expect(champion?.score).toBe(500);
    expect(champion?.challengeAwards).toEqual({ duel: 0 });
    expect(applyChallengeAward(challenger!, challenge, "challenger")).toBeUndefined();
  });

  it("applies the leader-win transfer to both progress records", () => {
    const leaderWin = { ...challenge, winnerUid: "champion" };
    const challenger = applyChallengeAward(
      { score: 900, solvedCount: 5, solved: {} },
      leaderWin,
      "challenger",
    );
    const champion = applyChallengeAward(
      { score: 1_000, solvedCount: 5, solved: {} },
      leaderWin,
      "champion",
    );

    expect(challenger?.score).toBe(350);
    expect(champion?.score).toBe(1_550);
  });
});
