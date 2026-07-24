import type { Difficulty, Problem } from "../data/problemTypes";
import type { RoomChallenge } from "./multiplayer";

export interface RaceEvent {
  id: string;
  message: string;
  tone: "good" | "bad" | "neutral";
  createdAt: number;
}

export interface Racer {
  id: string;
  name: string;
  score: number;
  isUser?: boolean;
  online?: boolean;
}

export interface RaceController {
  score: number;
  solvedIds: string[];
  activeProblem: Problem | null;
  pendingProblem?: Problem | null;
  timedDeadline?: number | null;
  editorCode: string;
  stdin: string;
  racers: Racer[];
  rank: number;
  remaining: Record<Difficulty, number>;
  events: RaceEvent[];
  interactionReady?: boolean;
  currentStreak?: number;
  challenge?: RoomChallenge | null;
  headToHead?: boolean;
  canChallenge?: boolean;
  requestChallenge?: (difficulty: Difficulty) => Promise<void>;
  selectProblem: (difficulty: Difficulty) => "selected" | "active" | "exhausted";
  startPendingProblem?: () => void;
  expireTimedProblem?: (problem: Problem) => void | Promise<void>;
  recordMiss?: (problem: Problem) => void | Promise<void>;
  solve: (problem: Problem) => number | Promise<number>;
  forfeit: (problem: Problem) => void | Promise<void>;
  reset?: () => void;
  setEditorCode: (value: string) => void;
  setStdin: (value: string) => void;
}
