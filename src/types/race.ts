import type { Difficulty, Problem } from "../data/problemTypes";

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
  editorCode: string;
  stdin: string;
  racers: Racer[];
  rank: number;
  remaining: Record<Difficulty, number>;
  events: RaceEvent[];
  selectProblem: (difficulty: Difficulty) => "selected" | "active" | "exhausted";
  solve: (problem: Problem) => void | Promise<void>;
  forfeit: (problem: Problem) => void | Promise<void>;
  reset?: () => void;
  setEditorCode: (value: string) => void;
  setStdin: (value: string) => void;
}
