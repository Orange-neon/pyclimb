import type {
  PlayerProgress,
  RoomChallenge,
  RoomChallengeStatus,
} from "../types/multiplayer";

export const CHALLENGER_WIN_PRIZE = 1_000;

export function canIssueLeaderChallenge(
  streak: number,
  rank: number,
  playerCount: number,
  currentStatus?: RoomChallengeStatus,
  hasActiveDraft = false,
): boolean {
  return (
    streak >= 5 &&
    rank > 1 &&
    playerCount > 1 &&
    !hasActiveDraft &&
    !currentStatus
  );
}

export function isChallengeSelectionBlocked(
  challenge: RoomChallenge | null,
  uid: string,
  challengeLoaded = true,
): boolean {
  if (!challengeLoaded) return true;
  return Boolean(
    challenge &&
      ((challenge.status === "active" &&
        (challenge.challengerUid === uid || challenge.championUid === uid)) ||
        (challenge.status === "waiting" && challenge.challengerUid === uid)),
  );
}

export function assertChallengeStateLoaded(challengeLoaded: boolean): void {
  if (!challengeLoaded) {
    throw new Error(
      "Room challenge state is still syncing. Try again in a moment.",
    );
  }
}

export function shouldClearChallengeDraft(
  draftChallengeId: string | null | undefined,
  challenge: RoomChallenge | null,
  uid: string,
  challengeLoaded: boolean,
): boolean {
  if (!draftChallengeId || !challengeLoaded) return false;
  return !(
    challenge &&
    challenge.id === draftChallengeId &&
    challenge.status === "active" &&
    (challenge.challengerUid === uid || challenge.championUid === uid)
  );
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

export function applyChallengeAward(
  progress: PlayerProgress,
  challenge: RoomChallenge,
  uid: string,
): PlayerProgress | undefined {
  if (
    challenge.status !== "finished" ||
    !challenge.winnerUid ||
    (challenge.challengerUid !== uid && challenge.championUid !== uid) ||
    progress.challengeAwards?.[challenge.id] !== undefined
  ) {
    return undefined;
  }
  const delta = getChallengeScoreDelta(challenge, uid, challenge.problemReward);
  return {
    ...progress,
    score: progress.score + delta,
    challengeAwards: {
      ...(progress.challengeAwards ?? {}),
      [challenge.id]: delta,
    },
  };
}
