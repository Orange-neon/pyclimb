import type { RaceEvent } from "./race";
import type { AdaptiveProfiles } from "../data/adaptiveLearning";
import type { Difficulty } from "../data/problemTypes";

export type RoomStatus = "lobby" | "active" | "finished";
export type RoomEndReason = "time" | "host" | "completed" | null;

export interface RoomMeta {
  hostUid: string;
  hostOnline: boolean;
  status: RoomStatus;
  bankVersion: string;
  topicIds?: string;
  problemCount: number;
  durationSeconds: number;
  unlimited?: boolean;
  createdAt: number;
  startedAt: number | null;
  endsAt: number | null;
  endedAt: number | null;
  endReason: RoomEndReason;
}

export interface RoomPlayer {
  uid: string;
  nickname: string;
  normalizedNickname: string;
  score: number;
  correctCount: number;
  joinedAt: number;
  lastAcceptedAt: number | null;
  online: boolean;
  ready: boolean;
}

export interface PlayerProgress {
  score: number;
  solvedCount: number;
  currentStreak?: number;
  solved: Record<string, number>;
  adaptive?: AdaptiveProfiles;
  challengeAwards?: Record<string, number>;
}

export type RoomChallengeStatus = "waiting" | "active" | "finished";

export interface RoomChallenge {
  id: string;
  status: RoomChallengeStatus;
  challengerUid: string;
  challengerName: string;
  championUid: string;
  championName: string;
  difficulty: Difficulty;
  problemId: string;
  problemReward: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  winnerUid: string | null;
}

export interface RoomSession {
  code: string;
  uid: string;
  role: "host" | "player";
  nickname?: string;
}

export interface RoomSnapshot {
  meta: RoomMeta | null;
  players: RoomPlayer[];
  progress: PlayerProgress;
  events: RaceEvent[];
}
