import { describe, expect, it } from "vitest";
import type { RoomChallenge } from "../types/multiplayer";
import {
  canIssueLeaderChallenge,
  CHALLENGER_WIN_PRIZE,
  getChallengeScoreDelta,
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
});
