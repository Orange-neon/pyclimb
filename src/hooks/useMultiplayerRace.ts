import { useCallback, useEffect, useMemo, useState } from "react";
import type { Difficulty, Problem, ProblemBank } from "../data/problemTypes";
import { DOUBLE_MULTIPLIER, TIMED_PROBLEM_SECONDS } from "../data/timedProblems";
import { getRemainingCounts, pickUnsolvedProblem } from "../lib/raceLogic";
import type { PlayerProgress, RoomChallenge, RoomPlayer, RoomSession } from "../types/multiplayer";
import type { RaceEvent, Racer } from "../types/race";
import { canIssueLeaderChallenge } from "../lib/challengeLogic";

interface DraftState {
  activeProblemId: string | null;
  pendingProblemId: string | null;
  timedDeadline: number | null;
  editorCode: string;
  stdin: string;
}

const EMPTY_DRAFT: DraftState = {
  activeProblemId: null,
  pendingProblemId: null,
  timedDeadline: null,
  editorCode: "",
  stdin: "",
};

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
  recordMiss: (problem: Problem) => Promise<void>;
  recordSolve: (problem: Problem, multiplier?: number) => Promise<number>;
  recordForfeit: (problem: Problem) => Promise<void>;
  recordBombExpiry: (problem: Problem) => Promise<void>;
  requestChallenge: (difficulty: Difficulty) => Promise<void>;
  recordChallengeSolve: (problem: Problem) => Promise<number>;
  challenge: RoomChallenge | null;
}

export function useMultiplayerRace({
  bank,
  session,
  players,
  progress,
  events,
  recordMiss,
  recordSolve,
  recordForfeit,
  recordBombExpiry,
  requestChallenge,
  recordChallengeSolve,
  challenge,
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
  const pendingProblem = useMemo(
    () => bank.problems.find((problem) => problem.id === draft.pendingProblemId) ?? null,
    [bank.problems, draft.pendingProblemId],
  );
  const challengeParticipant = Boolean(
    challenge &&
      (challenge.challengerUid === session.uid || challenge.championUid === session.uid),
  );

  useEffect(() => {
    if (!challengeParticipant || !challenge) return;
    if (challenge.status === "active") {
      const problem = bank.problems.find((item) => item.id === challenge.problemId);
      if (!problem) return;
      setDraft({
        activeProblemId: problem.id,
        pendingProblemId: null,
        timedDeadline: null,
        editorCode: problem.starterCode,
        stdin: problem.testCases[0]?.input ?? "",
      });
    } else if (challenge.status === "finished" && draft.activeProblemId === challenge.problemId) {
      setDraft(EMPTY_DRAFT);
    }
  }, [bank.problems, challenge, challengeParticipant, draft.activeProblemId]);

  const selectProblem = useCallback(
    (difficulty: Difficulty): "selected" | "active" | "exhausted" => {
      if (draft.activeProblemId || draft.pendingProblemId || (challengeParticipant && challenge?.status === "active")) return "active";
      const problem = pickUnsolvedProblem(
        bank.problems,
        difficulty,
        solvedIds,
        progress.adaptive?.[difficulty],
      );
      if (!problem) return "exhausted";
      setDraft(
        problem.timedMode
          ? { ...EMPTY_DRAFT, pendingProblemId: problem.id }
          : {
              ...EMPTY_DRAFT,
              activeProblemId: problem.id,
              editorCode: problem.starterCode,
              stdin: problem.testCases[0]?.input ?? "",
            },
      );
      return "selected";
    },
    [bank.problems, challenge?.status, challengeParticipant, draft.activeProblemId, draft.pendingProblemId, progress.adaptive, solvedIds],
  );

  const startPendingProblem = useCallback(() => {
    const problem = bank.problems.find((item) => item.id === draft.pendingProblemId);
    if (!problem) return;
    setDraft({
      activeProblemId: problem.id,
      pendingProblemId: null,
      timedDeadline: Date.now() + TIMED_PROBLEM_SECONDS[problem.difficulty] * 1000,
      editorCode: problem.starterCode,
      stdin: problem.testCases[0]?.input ?? "",
    });
  }, [bank.problems, draft.pendingProblemId]);

  const solve = useCallback(
    async (problem: Problem) => {
      const isChallenge =
        challengeParticipant && challenge?.status === "active" && challenge.problemId === problem.id;
      if (
        !isChallenge &&
        problem.timedMode === "bomb" &&
        draft.timedDeadline !== null &&
        Date.now() > draft.timedDeadline
      ) {
        throw new Error("The bomb timer expired before the solution was submitted.");
      }
      const points = isChallenge
        ? await recordChallengeSolve(problem)
        : await recordSolve(
            problem,
            problem.timedMode === "double" &&
              draft.timedDeadline !== null &&
              Date.now() <= draft.timedDeadline
              ? DOUBLE_MULTIPLIER
              : 1,
          );
      setDraft(EMPTY_DRAFT);
      return points;
    },
    [challenge, challengeParticipant, draft.timedDeadline, recordChallengeSolve, recordSolve],
  );

  const forfeit = useCallback(
    async (problem: Problem) => {
      if (challengeParticipant && challenge?.status === "active") {
        throw new Error("A head-to-head challenge must be raced to the finish.");
      }
      await recordForfeit(problem);
      setDraft(EMPTY_DRAFT);
    },
    [challenge?.status, challengeParticipant, recordForfeit],
  );

  const expireTimedProblem = useCallback(
    async (problem: Problem) => {
      await recordBombExpiry(problem);
      setDraft(EMPTY_DRAFT);
    },
    [recordBombExpiry],
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
    pendingProblem,
    timedDeadline: draft.timedDeadline,
    editorCode: draft.editorCode,
    stdin: draft.stdin,
    racers,
    rank,
    remaining,
    events,
    currentStreak: progress.currentStreak ?? 0,
    challenge,
    headToHead: challengeParticipant && challenge?.status === "active",
    canChallenge: canIssueLeaderChallenge(
      progress.currentStreak ?? 0,
      rank,
      racers.length,
      challenge?.status,
    ),
    requestChallenge,
    selectProblem,
    startPendingProblem,
    expireTimedProblem,
    recordMiss,
    solve,
    forfeit,
    setEditorCode: (editorCode: string) => setDraft((current) => ({ ...current, editorCode })),
    setStdin: (stdin: string) => setDraft((current) => ({ ...current, stdin })),
    clearDraft: () => setDraft(EMPTY_DRAFT),
  };
}
