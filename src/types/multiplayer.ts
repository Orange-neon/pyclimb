import type { RaceEvent } from "./race";

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
  solved: Record<string, number>;
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
