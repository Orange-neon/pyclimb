import { useCallback, useEffect, useMemo, useState } from "react";
import type { Difficulty, Problem, ProblemBank } from "../data/problemTypes";
import { getRemainingCounts, pickUnsolvedProblem } from "../lib/raceLogic";
import type { PlayerProgress, RoomPlayer, RoomSession } from "../types/multiplayer";
import type { RaceEvent, Racer } from "../types/race";

interface DraftState {
  activeProblemId: string | null;
  editorCode: string;
  stdin: string;
}

const EMPTY_DRAFT: DraftState = { activeProblemId: null, editorCode: "", stdin: "" };

function draftKey(session: RoomSession) {
  return `col.draft.${session.code}.${session.uid}`;
}

function legacyDraftKey(session: RoomSession) {
  return `pyclimb.draft.${session.code}.${session.uid}`;
}

function readDraft(session: RoomSession): DraftState {
  try {
    const current = localStorage.getItem(draftKey(session));
    const legacyKey = legacyDraftKey(session);
    const legacy = current === null ? localStorage.getItem(legacyKey) : null;
    if (legacy !== null) {
      localStorage.setItem(draftKey(session), legacy);
      localStorage.removeItem(legacyKey);
    }
    return {
      ...EMPTY_DRAFT,
      ...(JSON.parse(current ?? legacy ?? "null") as DraftState | null),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

interface MultiplayerRaceOptions {
  bank: ProblemBank;
  session: RoomSession;
  players: RoomPlayer[];
  progress: PlayerProgress;
  events: RaceEvent[];
  recordSolve: (problem: Problem) => Promise<void>;
  recordForfeit: (problem: Problem) => Promise<void>;
}

export function useMultiplayerRace({
  bank,
  session,
  players,
  progress,
  events,
  recordSolve,
  recordForfeit,
}: MultiplayerRaceOptions) {
  const [draft, setDraft] = useState<DraftState>(() => readDraft(session));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(draftKey(session), JSON.stringify(draft));
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [draft, session]);

  const solvedIds = useMemo(() => Object.keys(progress.solved ?? {}), [progress.solved]);
  const activeProblem = useMemo(
    () => bank.problems.find((problem) => problem.id === draft.activeProblemId) ?? null,
    [bank.problems, draft.activeProblemId],
  );

  const selectProblem = useCallback(
    (difficulty: Difficulty): "selected" | "active" | "exhausted" => {
      if (draft.activeProblemId) return "active";
      const problem = pickUnsolvedProblem(bank.problems, difficulty, solvedIds);
      if (!problem) return "exhausted";
      setDraft({
        activeProblemId: problem.id,
        editorCode: problem.starterCode,
        stdin: problem.testCases[0]?.input ?? "",
      });
      return "selected";
    },
    [bank.problems, draft.activeProblemId, solvedIds],
  );

  const solve = useCallback(
    async (problem: Problem) => {
      await recordSolve(problem);
      setDraft(EMPTY_DRAFT);
    },
    [recordSolve],
  );

  const forfeit = useCallback(
    async (problem: Problem) => {
      await recordForfeit(problem);
      setDraft(EMPTY_DRAFT);
    },
    [recordForfeit],
  );

  const racers = useMemo<Racer[]>(
    () =>
      players.map((player) => ({
        id: player.uid,
        name: player.uid === session.uid ? `${player.nickname} (You)` : player.nickname,
        score: player.score,
        isUser: player.uid === session.uid,
        online: player.online,
      })),
    [players, session.uid],
  );

  const rank = Math.max(1, racers.findIndex((racer) => racer.isUser) + 1);
  const remaining = useMemo(
    () => getRemainingCounts(bank.problems, solvedIds),
    [bank.problems, solvedIds],
  );

  return {
    score: progress.score,
    solvedIds,
    activeProblem,
    editorCode: draft.editorCode,
    stdin: draft.stdin,
    racers,
    rank,
    remaining,
    events,
    selectProblem,
    solve,
    forfeit,
    setEditorCode: (editorCode: string) => setDraft((current) => ({ ...current, editorCode })),
    setStdin: (stdin: string) => setDraft((current) => ({ ...current, stdin })),
    clearDraft: () => setDraft(EMPTY_DRAFT),
  };
}
