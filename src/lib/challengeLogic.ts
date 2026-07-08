import type { RoomChallenge, RoomChallengeStatus } from "../types/multiplayer";

export const CHALLENGER_WIN_PRIZE = 1_000;

export function canIssueLeaderChallenge(
  streak: number,
  rank: number,
  playerCount: number,
  currentStatus?: RoomChallengeStatus,
): boolean {
  return streak >= 5 && rank > 1 && playerCount > 1 && (!currentStatus || currentStatus === "finished");
}

export function getChallengeScoreDelta(
  challenge: RoomChallenge,
  uid: string,
  problemReward: number,
): number {
  if (challenge.status !== "finished" || !challenge.winnerUid) return 0;
  if (uid === challenge.challengerUid) {
    return challenge.winnerUid === uid ? CHALLENGER_WIN_PRIZE : -problemReward;
  }
  if (uid === challenge.championUid && challenge.winnerUid === uid) return problemReward;
  return 0;
}
