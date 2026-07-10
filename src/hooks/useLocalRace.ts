import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAdaptiveProfiles,
  normalizeAdaptiveProfile,
  updateAdaptiveProfile,
  type AdaptiveProfiles,
} from "../data/adaptiveLearning";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import { getProblemReward } from "../data/problemProgression";
import type { Difficulty, Problem, ProblemBank } from "../data/problemTypes";
import { BOMB_PENALTY, getTimedProblemReward, TIMED_PROBLEM_SECONDS } from "../data/timedProblems";
import { createBotAction, createBotSolveDelay } from "../lib/botSimulation";
import { canIssueLeaderChallenge, CHALLENGER_WIN_PRIZE } from "../lib/challengeLogic";
import { getRemainingCounts, pickUnsolvedProblem } from "../lib/raceLogic";
import type { RoomChallenge } from "../types/multiplayer";
import type { RaceEvent, Racer } from "../types/race";

const STORAGE_KEY = "col.local-race.v0";
const LEGACY_STORAGE_KEY = "pyclimb.local-race.v0";

interface PersistedRace {
  botSimulationVersion: number;
  startedAt: number;
  adaptiveProfiles: AdaptiveProfiles;
  score: number;
  currentStreak: number;
  solvedIds: string[];
  activeProblemId: string | null;
  pendingProblemId: string | null;
  timedDeadline: number | null;
  editorCode: string;
  stdin: string;
  botScores: Record<string, number>;
  events: RaceEvent[];
  challenge: SoloChallenge | null;
}

interface SoloChallenge extends RoomChallenge {
  botSolveAt: number;
}

const INITIAL_BOTS = {
  ScriptKiddy: 0,
  PyMaster: 0,
  NullPointer: 0,
  Guido: 0,
};

const initialState: PersistedRace = {
  botSimulationVersion: 3,
  startedAt: Date.now(),
  adaptiveProfiles: createAdaptiveProfiles(),
  score: 0,
  currentStreak: 0,
  solvedIds: [],
  activeProblemId: null,
  pendingProblemId: null,
  timedDeadline: null,
  editorCode: "",
  stdin: "",
  botScores: INITIAL_BOTS,
  events: [],
  challenge: null,
};

function readRace(): PersistedRace {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = current === null ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    const parsed = JSON.parse(current ?? legacy ?? "null") as Partial<PersistedRace>;
    if (!parsed || typeof parsed.score !== "number") return initialState;
    if (legacy !== null) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return {
      ...initialState,
      ...parsed,
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : Date.now(),
      currentStreak: Math.max(0, Number(parsed.currentStreak) || 0),
      adaptiveProfiles: {
        easy: normalizeAdaptiveProfile(parsed.adaptiveProfiles?.easy),
        medium: normalizeAdaptiveProfile(parsed.adaptiveProfiles?.medium),
        hard: normalizeAdaptiveProfile(parsed.adaptiveProfiles?.hard),
      },
      solvedIds: Array.isArray(parsed.solvedIds) ? parsed.solvedIds : [],
      botScores:
        parsed.botSimulationVersion === initialState.botSimulationVersion
          ? { ...INITIAL_BOTS, ...parsed.botScores }
          : { ...INITIAL_BOTS },
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, 12) : [],
      challenge: parsed.challenge ?? null,
    };
  } catch {
    return initialState;
  }
}

function event(message: string, tone: RaceEvent["tone"]): RaceEvent {
  return { id: crypto.randomUUID(), message, tone, createdAt: Date.now() };
}

export function useLocalRace(bank: ProblemBank, active = true) {
  const [state, setState] = useState<PersistedRace>(readRace);
  const stateRef = useRef(state);
  const activeRef = useRef(active);
  stateRef.current = state;
  activeRef.current = active;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [state]);

  useEffect(() => {
    if (
      stateRef.current.activeProblemId &&
      !bank.problems.some((problem) => problem.id === stateRef.current.activeProblemId)
    ) {
      setState((current) => ({
        ...current,
        activeProblemId: null,
        pendingProblemId: null,
        timedDeadline: null,
        editorCode: "",
        stdin: "",
        challenge: current.challenge?.status === "active" ? null : current.challenge,
      }));
    }
  }, [bank.problems]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timeoutIds = new Set<number>();

    const schedule = (name: keyof typeof INITIAL_BOTS) => {
      const action = createBotAction();
      const timeoutId = window.setTimeout(() => {
        timeoutIds.delete(timeoutId);
        if (cancelled) return;

        const amount = Math.abs(action.delta);
        const message = action.forfeited
          ? `${name} forfeited a ${action.difficulty} climb (-${amount})`
          : `${name} cleared a ${action.difficulty} climb (+${amount})`;
        setState((current) => ({
          ...current,
          botScores: {
            ...current.botScores,
            [name]: current.botScores[name] + action.delta,
          },
          events: [event(message, action.forfeited ? "bad" : "neutral"), ...current.events].slice(0, 12),
        }));
        schedule(name);
      }, action.delayMs);
      timeoutIds.add(timeoutId);
    };

    for (const name of Object.keys(INITIAL_BOTS) as Array<keyof typeof INITIAL_BOTS>) {
      schedule(name);
    }

    return () => {
      cancelled = true;
      for (const timeoutId of timeoutIds) window.clearTimeout(timeoutId);
    };
  }, [active]);

  useEffect(() => {
    if (!active || state.challenge?.status !== "active") return;
    const challengeId = state.challenge.id;
    const finishChallenge = () => {
      setState((current) => {
        const challenge = current.challenge;
        if (!challenge || challenge.id !== challengeId || challenge.status !== "active") return current;
        const finishedAt = Date.now();
        return {
          ...current,
          score: current.score - challenge.problemReward,
          currentStreak: 0,
          activeProblemId: null,
          timedDeadline: null,
          editorCode: "",
          stdin: "",
          botScores: {
            ...current.botScores,
            [challenge.championUid]:
              (current.botScores[challenge.championUid] ?? 0) + challenge.problemReward,
          },
          challenge: {
            ...challenge,
            status: "finished",
            winnerUid: challenge.championUid,
            finishedAt,
          },
          events: [
            event(
              `${challenge.championName} won the head-to-head challenge (+${challenge.problemReward})`,
              "bad",
            ),
            ...current.events,
          ].slice(0, 12),
        };
      });
    };
    const remaining = state.challenge.botSolveAt - Date.now();
    if (remaining <= 0) {
      finishChallenge();
      return;
    }
    const timeoutId = window.setTimeout(finishChallenge, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [active, state.challenge?.botSolveAt, state.challenge?.id, state.challenge?.status]);

  const activeProblem = useMemo(
    () => bank.problems.find((problem) => problem.id === state.activeProblemId) ?? null,
    [bank.problems, state.activeProblemId],
  );
  const pendingProblem = useMemo(
    () => bank.problems.find((problem) => problem.id === state.pendingProblemId) ?? null,
    [bank.problems, state.pendingProblemId],
  );

  const selectProblem = useCallback(
    (difficulty: Difficulty): "selected" | "active" | "exhausted" => {
      if (!activeRef.current) return "exhausted";
      if (stateRef.current.activeProblemId || stateRef.current.pendingProblemId) return "active";
      const problem = pickUnsolvedProblem(
        bank.problems,
        difficulty,
        stateRef.current.solvedIds,
        stateRef.current.adaptiveProfiles[difficulty],
      );
      if (!problem) return "exhausted";
      setState((current) =>
        problem.timedMode
          ? { ...current, pendingProblemId: problem.id }
          : {
              ...current,
              activeProblemId: problem.id,
              editorCode: problem.starterCode,
              stdin: problem.testCases[0]?.input ?? "",
            },
      );
      return "selected";
    },
    [bank.problems],
  );

  const startPendingProblem = useCallback(() => {
    setState((current) => {
      const problem = bank.problems.find((item) => item.id === current.pendingProblemId);
      if (!problem) return current;
      return {
        ...current,
        pendingProblemId: null,
        activeProblemId: problem.id,
        editorCode: problem.starterCode,
        stdin: problem.testCases[0]?.input ?? "",
        timedDeadline: Date.now() + TIMED_PROBLEM_SECONDS[problem.difficulty] * 1000,
      };
    });
  }, [bank.problems]);

  const solve = useCallback((problem: Problem) => {
    if (!activeRef.current) return 0;
    if (stateRef.current.activeProblemId !== problem.id) {
      throw new Error("This problem is no longer active.");
    }
    const activeChallenge = stateRef.current.challenge;
    const isChallenge = Boolean(
      activeChallenge?.status === "active" && activeChallenge.problemId === problem.id,
    );
    if (
      !isChallenge &&
      problem.timedMode === "bomb" &&
      stateRef.current.timedDeadline !== null &&
      Date.now() > stateRef.current.timedDeadline
    ) {
      throw new Error("The speed timer expired before the solution was submitted.");
    }
    const awardedPoints = isChallenge
      ? CHALLENGER_WIN_PRIZE
      : getTimedProblemReward(
          getProblemReward(problem),
          problem.timedMode,
          stateRef.current.timedDeadline,
          Date.now(),
        );
    setState((current) => {
      if (current.solvedIds.includes(problem.id)) return current;
      return {
        ...current,
        score: current.score + awardedPoints,
        currentStreak: current.currentStreak + 1,
        adaptiveProfiles: {
          ...current.adaptiveProfiles,
          [problem.difficulty]: updateAdaptiveProfile(
            current.adaptiveProfiles[problem.difficulty],
            "solved",
          ),
        },
        solvedIds: [...current.solvedIds, problem.id],
        challenge: isChallenge && current.challenge
          ? {
              ...current.challenge,
              status: "finished",
              winnerUid: "you",
              finishedAt: Date.now(),
            }
          : current.challenge,
        activeProblemId: null,
        timedDeadline: null,
        editorCode: "",
        stdin: "",
        events: [
          event(
            isChallenge
              ? `You beat ${current.challenge?.championName ?? "the leader"} in the head-to-head challenge (+${awardedPoints})`
              : `You solved ${problem.title} (+${awardedPoints})`,
            "good",
          ),
          ...current.events,
        ].slice(0, 12),
      };
    });
    return awardedPoints;
  }, []);

  const forfeit = useCallback((problem: Problem) => {
    if (!activeRef.current) return;
    if (stateRef.current.challenge?.status === "active") {
      throw new Error("A head-to-head challenge must be raced to the finish.");
    }
    const penalty = DIFFICULTY_CONFIG[problem.difficulty].penalty;
    setState((current) => ({
      ...current,
      score: current.score - penalty,
      currentStreak: 0,
      adaptiveProfiles: {
        ...current.adaptiveProfiles,
        [problem.difficulty]: updateAdaptiveProfile(
          current.adaptiveProfiles[problem.difficulty],
          "forfeited",
        ),
      },
      activeProblemId: null,
      timedDeadline: null,
      editorCode: "",
      stdin: "",
      events: [event(`You gave up ${problem.title} (-${penalty})`, "bad"), ...current.events].slice(0, 12),
    }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setState({
      ...initialState,
      startedAt: Date.now(),
      adaptiveProfiles: createAdaptiveProfiles(),
      botScores: { ...INITIAL_BOTS },
      events: [],
      challenge: null,
    });
  }, []);

  const expireTimedProblem = useCallback((problem: Problem) => {
    if (problem.timedMode !== "bomb") return;
    setState((current) => {
      if (current.activeProblemId !== problem.id) return current;
      return {
        ...current,
        score: current.score - BOMB_PENALTY,
        currentStreak: 0,
        activeProblemId: null,
        editorCode: "",
        stdin: "",
        timedDeadline: null,
        adaptiveProfiles: {
          ...current.adaptiveProfiles,
          [problem.difficulty]: updateAdaptiveProfile(
            current.adaptiveProfiles[problem.difficulty],
            "forfeited",
          ),
        },
        events: [event(`${problem.title} speed timer expired (-${BOMB_PENALTY})`, "bad"), ...current.events].slice(0, 12),
      };
    });
  }, []);

  const recordMiss = useCallback((problem: Problem) => {
    if (!activeRef.current) return;
    setState((current) => ({
      ...current,
      currentStreak: 0,
      adaptiveProfiles: {
        ...current.adaptiveProfiles,
        [problem.difficulty]: updateAdaptiveProfile(
          current.adaptiveProfiles[problem.difficulty],
          "missed",
        ),
      },
    }));
  }, []);

  const racers = useMemo<Racer[]>(
    () =>
      [
        { id: "you", name: "You", score: state.score, isUser: true },
        ...Object.entries(state.botScores).map(([name, score]) => ({ id: name, name, score })),
      ].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [state.botScores, state.score],
  );

  const rank = racers.findIndex((racer) => racer.isUser) + 1;

  const requestChallenge = useCallback(async (difficulty: Difficulty) => {
    const current = stateRef.current;
    const standings: Racer[] = [
      { id: "you", name: "You", score: current.score, isUser: true },
      ...Object.entries(current.botScores).map(([name, score]) => ({ id: name, name, score })),
    ].sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
    const currentRank = standings.findIndex((racer) => racer.isUser) + 1;
    if (
      !canIssueLeaderChallenge(
        current.currentStreak,
        currentRank,
        standings.length,
        current.challenge?.status,
      )
    ) {
      throw new Error("Build a five-problem streak while below first place to challenge the leader.");
    }
    if (current.activeProblemId || current.pendingProblemId) {
      throw new Error("Finish or give up the current problem before challenging the leader.");
    }
    const champion = standings[0];
    if (!champion || champion.isUser) throw new Error("You are already the leader.");
    const problem = pickUnsolvedProblem(
      bank.problems,
      difficulty,
      current.solvedIds,
      current.adaptiveProfiles[difficulty],
    );
    if (!problem) throw new Error(`No unsolved ${difficulty} problem remains.`);
    const now = Date.now();
    const challenge: SoloChallenge = {
      id: crypto.randomUUID(),
      status: "active",
      challengerUid: "you",
      challengerName: "You",
      championUid: champion.id,
      championName: champion.name,
      difficulty,
      problemId: problem.id,
      problemReward: getProblemReward(problem),
      createdAt: now,
      startedAt: now,
      finishedAt: null,
      winnerUid: null,
      botSolveAt: now + createBotSolveDelay(difficulty),
    };
    setState((value) => ({
      ...value,
      challenge,
      activeProblemId: problem.id,
      pendingProblemId: null,
      timedDeadline: null,
      editorCode: problem.starterCode,
      stdin: problem.testCases[0]?.input ?? "",
      events: [
        event(`You challenged leader ${champion.name} to a ${difficulty} race`, "neutral"),
        ...value.events,
      ].slice(0, 12),
    }));
  }, [bank.problems]);

  const remaining = useMemo(
    () => getRemainingCounts(bank.problems, state.solvedIds),
    [bank.problems, state.solvedIds],
  );

  return {
    ...state,
    activeProblem,
    pendingProblem,
    racers,
    rank,
    remaining,
    currentStreak: state.currentStreak,
    challenge: state.challenge,
    headToHead: state.challenge?.status === "active",
    canChallenge: canIssueLeaderChallenge(
      state.currentStreak,
      rank,
      racers.length,
      state.challenge?.status,
    ),
    requestChallenge,
    selectProblem,
    startPendingProblem,
    expireTimedProblem,
    solve,
    forfeit,
    recordMiss,
    reset,
    setEditorCode: (editorCode: string) => setState((current) => ({ ...current, editorCode })),
    setStdin: (stdin: string) => setState((current) => ({ ...current, stdin })),
  };
}
