import { useCallback, useEffect, useMemo, useState } from "react";
import type { Difficulty, Problem, ProblemBank } from "../data/problemTypes";
import { DOUBLE_MULTIPLIER, TIMED_PROBLEM_SECONDS } from "../data/timedProblems";
import { getRemainingCounts, pickUnsolvedProblem } from "../lib/raceLogic";
import type { PlayerProgress, RoomChallenge, RoomPlayer, RoomSession } from "../types/multiplayer";
import type { RaceEvent, Racer } from "../types/race";
import {
  assertChallengeStateLoaded,
  canIssueLeaderChallenge,
  isChallengeSelectionBlocked,
  shouldClearChallengeDraft,
} from "../lib/challengeLogic";

interface DraftState {
  activeProblemId: string | null;
  pendingProblemId: string | null;
  challengeId: string | null;
  timedDeadline: number | null;
  editorCode: string;
  stdin: string;
}

const EMPTY_DRAFT: DraftState = {
  activeProblemId: null,
  pendingProblemId: null,
  challengeId: null,
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
  challengeLoaded: boolean;
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
  challengeLoaded,
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
    if (!challengeLoaded) return;
    if (
      shouldClearChallengeDraft(
        draft.challengeId,
        challenge,
        session.uid,
        challengeLoaded,
      )
    ) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    if (!challengeParticipant || !challenge) return;
    if (challenge.status === "active") {
      const problem = bank.problems.find((item) => item.id === challenge.problemId);
      if (!problem) return;
      if (
        draft.challengeId === challenge.id &&
        draft.activeProblemId === problem.id
      ) {
        return;
      }
      setDraft({
        activeProblemId: problem.id,
        pendingProblemId: null,
        challengeId: challenge.id,
        timedDeadline: null,
        editorCode: problem.starterCode,
        stdin: problem.testCases[0]?.input ?? "",
      });
    } else if (challenge.status === "finished" && draft.activeProblemId === challenge.problemId) {
      setDraft(EMPTY_DRAFT);
    }
  }, [
    bank.problems,
    challenge,
    challengeLoaded,
    challengeParticipant,
    draft.activeProblemId,
    draft.challengeId,
    session.uid,
  ]);

  const selectProblem = useCallback(
    (difficulty: Difficulty): "selected" | "active" | "exhausted" => {
      if (
        !challengeLoaded ||
        draft.activeProblemId ||
        draft.pendingProblemId ||
        isChallengeSelectionBlocked(
          challenge,
          session.uid,
          challengeLoaded,
        )
      ) {
        return "active";
      }
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
    [bank.problems, challenge, challengeLoaded, draft.activeProblemId, draft.pendingProblemId, progress.adaptive, session.uid, solvedIds],
  );

  const startPendingProblem = useCallback(() => {
    if (!challengeLoaded) return;
    const problem = bank.problems.find((item) => item.id === draft.pendingProblemId);
    if (!problem) return;
    setDraft({
      activeProblemId: problem.id,
      pendingProblemId: null,
      challengeId: null,
      timedDeadline: Date.now() + TIMED_PROBLEM_SECONDS[problem.difficulty] * 1000,
      editorCode: problem.starterCode,
      stdin: problem.testCases[0]?.input ?? "",
    });
  }, [bank.problems, challengeLoaded, draft.pendingProblemId]);

  const solve = useCallback(
    async (problem: Problem) => {
      assertChallengeStateLoaded(challengeLoaded);
      const isChallenge =
        challengeParticipant && challenge?.status === "active" && challenge.problemId === problem.id;
      if (
        !isChallenge &&
        problem.timedMode === "bomb" &&
        draft.timedDeadline !== null &&
        Date.now() > draft.timedDeadline
      ) {
        throw new Error("The speed timer expired before the solution was submitted.");
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
    [challenge, challengeLoaded, challengeParticipant, draft.timedDeadline, recordChallengeSolve, recordSolve],
  );

  const forfeit = useCallback(
    async (problem: Problem) => {
      assertChallengeStateLoaded(challengeLoaded);
      if (challengeParticipant && challenge?.status === "active") {
        throw new Error("A head-to-head challenge must be raced to the finish.");
      }
      await recordForfeit(problem);
      setDraft(EMPTY_DRAFT);
    },
    [challenge?.status, challengeLoaded, challengeParticipant, recordForfeit],
  );

  const expireTimedProblem = useCallback(
    async (problem: Problem) => {
      assertChallengeStateLoaded(challengeLoaded);
      await recordBombExpiry(problem);
      setDraft(EMPTY_DRAFT);
    },
    [challengeLoaded, recordBombExpiry],
  );

  const guardedRecordMiss = useCallback(
    async (problem: Problem) => {
      assertChallengeStateLoaded(challengeLoaded);
      await recordMiss(problem);
    },
    [challengeLoaded, recordMiss],
  );

  const guardedRequestChallenge = useCallback(
    async (difficulty: Difficulty) => {
      assertChallengeStateLoaded(challengeLoaded);
      if (draft.activeProblemId || draft.pendingProblemId) {
        throw new Error(
          "Finish or give up your current problem before challenging the leader.",
        );
      }
      await requestChallenge(difficulty);
    },
    [challengeLoaded, draft.activeProblemId, draft.pendingProblemId, requestChallenge],
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
    interactionReady: challengeLoaded,
    currentStreak: progress.currentStreak ?? 0,
    challenge,
    headToHead: challengeParticipant && challenge?.status === "active",
    canChallenge:
      challengeLoaded &&
      canIssueLeaderChallenge(
        progress.currentStreak ?? 0,
        rank,
        racers.length,
        challenge?.status,
        Boolean(draft.activeProblemId || draft.pendingProblemId),
      ),
    requestChallenge: guardedRequestChallenge,
    selectProblem,
    startPendingProblem,
    expireTimedProblem,
    recordMiss: guardedRecordMiss,
    solve,
    forfeit,
    setEditorCode: (editorCode: string) => setDraft((current) => ({ ...current, editorCode })),
    setStdin: (stdin: string) => setDraft((current) => ({ ...current, stdin })),
    clearDraft: () => setDraft(EMPTY_DRAFT),
  };
}
