import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIFFICULTY_CONFIG } from "../data/difficulty";
import type { Difficulty, Problem, ProblemBank } from "../data/problemTypes";
import { createBotAction } from "../lib/botSimulation";
import { getRemainingCounts, pickUnsolvedProblem } from "../lib/raceLogic";
import type { RaceEvent, Racer } from "../types/race";

const STORAGE_KEY = "col.local-race.v0";
const LEGACY_STORAGE_KEY = "pyclimb.local-race.v0";

interface PersistedRace {
  botSimulationVersion: number;
  score: number;
  solvedIds: string[];
  activeProblemId: string | null;
  editorCode: string;
  stdin: string;
  botScores: Record<string, number>;
  events: RaceEvent[];
}

const INITIAL_BOTS = {
  ScriptKiddy: 0,
  PyMaster: 0,
  NullPointer: 0,
  Guido: 0,
};

const initialState: PersistedRace = {
  botSimulationVersion: 1,
  score: 0,
  solvedIds: [],
  activeProblemId: null,
  editorCode: "",
  stdin: "",
  botScores: INITIAL_BOTS,
  events: [],
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
      solvedIds: Array.isArray(parsed.solvedIds) ? parsed.solvedIds : [],
      botScores:
        parsed.botSimulationVersion === initialState.botSimulationVersion
          ? { ...INITIAL_BOTS, ...parsed.botScores }
          : { ...INITIAL_BOTS },
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, 12) : [],
    };
  } catch {
    return initialState;
  }
}

function event(message: string, tone: RaceEvent["tone"]): RaceEvent {
  return { id: crypto.randomUUID(), message, tone, createdAt: Date.now() };
}

export function useLocalRace(bank: ProblemBank) {
  const [state, setState] = useState<PersistedRace>(readRace);
  const stateRef = useRef(state);
  stateRef.current = state;

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
        editorCode: "",
        stdin: "",
      }));
    }
  }, [bank.problems]);

  useEffect(() => {
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
  }, []);

  const activeProblem = useMemo(
    () => bank.problems.find((problem) => problem.id === state.activeProblemId) ?? null,
    [bank.problems, state.activeProblemId],
  );

  const selectProblem = useCallback(
    (difficulty: Difficulty): "selected" | "active" | "exhausted" => {
      if (stateRef.current.activeProblemId) return "active";
      const problem = pickUnsolvedProblem(
        bank.problems,
        difficulty,
        stateRef.current.solvedIds,
      );
      if (!problem) return "exhausted";
      setState((current) => ({
        ...current,
        activeProblemId: problem.id,
        editorCode: problem.starterCode,
        stdin: problem.testCases[0]?.input ?? "",
      }));
      return "selected";
    },
    [bank.problems],
  );

  const solve = useCallback((problem: Problem) => {
    const points = DIFFICULTY_CONFIG[problem.difficulty].points;
    setState((current) => {
      if (current.solvedIds.includes(problem.id)) return current;
      return {
        ...current,
        score: current.score + points,
        solvedIds: [...current.solvedIds, problem.id],
        activeProblemId: null,
        editorCode: "",
        stdin: "",
        events: [event(`You solved ${problem.title} (+${points})`, "good"), ...current.events].slice(0, 12),
      };
    });
  }, []);

  const forfeit = useCallback((problem: Problem) => {
    const penalty = DIFFICULTY_CONFIG[problem.difficulty].penalty;
    setState((current) => ({
      ...current,
      score: current.score - penalty,
      activeProblemId: null,
      editorCode: "",
      stdin: "",
      events: [event(`You gave up ${problem.title} (-${penalty})`, "bad"), ...current.events].slice(0, 12),
    }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setState({ ...initialState, botScores: { ...INITIAL_BOTS } });
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

  const remaining = useMemo(
    () => getRemainingCounts(bank.problems, state.solvedIds),
    [bank.problems, state.solvedIds],
  );

  return {
    ...state,
    activeProblem,
    racers,
    rank,
    remaining,
    selectProblem,
    solve,
    forfeit,
    reset,
    setEditorCode: (editorCode: string) => setState((current) => ({ ...current, editorCode })),
    setStdin: (stdin: string) => setState((current) => ({ ...current, stdin })),
  };
}
