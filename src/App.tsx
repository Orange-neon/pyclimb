import confetti from "canvas-confetti";
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "./components/BrandLogo";
import { Console } from "./components/Console";
import { useFeedback } from "./components/Feedback";
import { HomeScreen } from "./components/HomeScreen";
import { HostDashboard } from "./components/HostDashboard";
import { LeaderboardTicker } from "./components/LeaderboardTicker";
import { Navbar } from "./components/Navbar";
import { RaceResults } from "./components/RaceResults";
import { RoomLobby } from "./components/RoomLobby";
import { SolutionModal } from "./components/SolutionModal";
import { Workspace } from "./components/Workspace";
import {
  filterProblemBankByTopics,
  parseTopicSelection,
  type CurriculumTopicId,
} from "./data/curriculum";
import { DIFFICULTY_CONFIG } from "./data/difficulty";
import { loadProblemBank } from "./data/problemBank";
import type { Difficulty, Problem, ProblemBank } from "./data/problemTypes";
import { useLocalRace } from "./hooks/useLocalRace";
import { useMultiplayerRace } from "./hooks/useMultiplayerRace";
import { usePyodide } from "./hooks/usePyodide";
import { useRaceRoom } from "./hooks/useRaceRoom";
import { compareOutput } from "./lib/judge";
import { formatCountdown } from "./lib/raceLogic";
import type { RoomMeta, RoomSession } from "./types/multiplayer";
import type { RaceController } from "./types/race";

type PythonController = ReturnType<typeof usePyodide>;

function useCountdown(
  meta: RoomMeta,
  serverNow: () => number,
  onExpire: () => void | Promise<void>,
) {
  const [seconds, setSeconds] = useState(() =>
    meta.endsAt ? Math.max(0, Math.ceil((meta.endsAt - serverNow()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!meta.endsAt || meta.status !== "active") return;
    let expired = false;
    const update = () => {
      const next = Math.max(0, Math.ceil((meta.endsAt! - serverNow()) / 1000));
      setSeconds(next);
      if (next === 0 && !expired) {
        expired = true;
        void onExpire();
      }
    };
    update();
    const intervalId = window.setInterval(update, 500);
    return () => window.clearInterval(intervalId);
  }, [meta.endsAt, meta.status, onExpire, serverNow]);

  return formatCountdown(seconds);
}

function LoadingScreen({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070b16] p-6 text-center">
      <div>
        {error ? (
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-rose-400/10 text-rose-300">
            <AlertTriangle size={30} />
          </div>
        ) : (
          <BrandLogo className="mx-auto mb-5 size-16 rounded-2xl object-contain shadow-xl shadow-sky-500/20" />
        )}
        <h1 className="text-2xl font-black text-white">
          {error ? "The trail did not load" : "Setting the course…"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
          {error ?? "Loading the challenge bank and race state."}
        </p>
        {error && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2 text-sm font-black text-slate-950"
          >
            <RefreshCw size={16} /> Try again
          </button>
        ) : (
          <LoaderCircle className="mx-auto mt-5 animate-spin text-sky-300" />
        )}
      </div>
    </main>
  );
}

interface GameShellProps {
  bank: ProblemBank;
  race: RaceController;
  python: PythonController;
  simulated?: boolean;
  roomCode?: string;
  timeRemaining?: string;
  onReset?: () => void;
  onExit?: () => void;
}

function GameShell({
  bank,
  race,
  python,
  simulated = false,
  roomCode,
  timeRemaining,
  onReset,
  onExit,
}: GameShellProps) {
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [solutionProblem, setSolutionProblem] = useState<Problem | null>(null);
  const { confirm, notify } = useFeedback();

  const selectDifficulty = (difficulty: Difficulty) => {
    const result = race.selectProblem(difficulty);
    if (result === "active") {
      notify({
        tone: "warning",
        title: "Challenge already in progress",
        message: "Give up or solve the current challenge before switching difficulty.",
      });
    }
    else if (result === "exhausted") {
      notify({
        tone: "info",
        title: `${DIFFICULTY_CONFIG[difficulty].label} trail completed`,
        message: `You have solved every ${difficulty} challenge in this race.`,
      });
    } else {
      setOutput(`$ ${DIFFICULTY_CONFIG[difficulty].label} challenge selected. Good luck!`);
    }
  };

  const runCode = async () => {
    if (!race.activeProblem || busy) return;
    setBusy(true);
    setOutput("$ Running solution.py…");
    const result = await python.execute(race.editorCode, race.stdin);
    setOutput(
      result.timedOut
        ? result.stderr
        : [result.stdout, result.stderr].filter(Boolean).join(result.stdout && result.stderr ? "\n" : "") ||
            `$ Finished in ${Math.round(result.durationMs)}ms with no output.`,
    );
    setBusy(false);
  };

  const submitSolution = async () => {
    const problem = race.activeProblem;
    if (!problem || busy) return;
    setBusy(true);

    for (let index = 0; index < problem.testCases.length; index += 1) {
      const testCase = problem.testCases[index];
      setOutput(`$ Checking test ${index + 1} of ${problem.testCases.length}…`);
      const result = await python.execute(race.editorCode, testCase.input);
      const comparison = compareOutput(result.stdout, testCase.expectedOutput);
      const { actual, expected } = comparison;

      if (result.error || !comparison.passed) {
        setOutput(
          [
            `✗ Test ${index + 1} failed`,
            "",
            "Input:",
            testCase.input || "(empty)",
            "",
            "Expected:",
            expected || "(empty)",
            "",
            "Your output:",
            actual || "(empty)",
            result.stderr ? `\nYour code raised an error:\n${result.stderr}` : "",
          ].join("\n"),
        );
        notify({
          tone: "error",
          title: `Test ${index + 1} did not pass`,
          message: "Review the terminal output, adjust your solution, and try again.",
        });
        setBusy(false);
        return;
      }
    }

    const points = DIFFICULTY_CONFIG[problem.difficulty].points;
    try {
      await race.solve(problem);
      setOutput(`✓ All ${problem.testCases.length} tests passed!\n+${points} points — summit reached.`);
      notify({
        tone: "success",
        title: `+${points} points`,
        message: `${problem.title} completed successfully.`,
      });
      confetti({
        particleCount: 110,
        spread: 72,
        origin: { y: 0.68 },
        colors: ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa"],
      });
      if (race.solvedIds.length + 1 === bank.problems.length) {
        notify({
          tone: "success",
          title: "Race complete",
          message: "You solved every challenge in the problem bank!",
          duration: 7_000,
        });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setOutput(`Score could not be saved:\n${message}`);
      notify({ tone: "error", title: "Score was not saved", message });
    } finally {
      setBusy(false);
    }
  };

  const giveUp = async () => {
    const problem = race.activeProblem;
    if (!problem || busy) return;
    const penalty = DIFFICULTY_CONFIG[problem.difficulty].penalty;
    const confirmed = await confirm({
      title: "Give up this challenge?",
      message: `${problem.title} will be forfeited and ${penalty} points will be deducted from your score.`,
      confirmLabel: "Give up",
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await race.forfeit(problem);
      setSolutionProblem(problem);
      setOutput(`Challenge forfeited. ${penalty} points deducted.`);
      notify({
        tone: "warning",
        title: "Challenge forfeited",
        message: `${penalty} points were deducted. The reference solution is now available.`,
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setOutput(`Forfeit could not be saved:\n${message}`);
      notify({ tone: "error", title: "Forfeit was not saved", message });
    } finally {
      setBusy(false);
    }
  };

  const stopExecution = () => {
    python.cancel();
    setBusy(false);
    setOutput("$ Run stopped. Python is warming back up…");
  };

  return (
    <div className="grid-glow min-h-screen bg-[#070b16] text-slate-100">
      <Navbar
        score={race.score}
        rank={race.rank}
        remaining={race.remaining}
        activeDifficulty={race.activeProblem?.difficulty}
        roomCode={roomCode}
        timeRemaining={timeRemaining}
        onSelectDifficulty={selectDifficulty}
        onReset={onReset}
      />

      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.75fr)] lg:px-6">
        <Workspace problem={race.activeProblem} code={race.editorCode} onCodeChange={race.setEditorCode} />
        <aside className="grid content-start gap-4">
          {python.status === "error" && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <div>
                  <strong className="block">Python failed to load</strong>
                  <p className="mt-1 text-xs leading-5 text-rose-200/70">{python.error}</p>
                  <button type="button" onClick={python.retry} className="mt-2 inline-flex items-center gap-1.5 font-bold text-white hover:underline">
                    <RefreshCw size={13} /> Retry engine
                  </button>
                </div>
              </div>
            </div>
          )}
          <Console
            stdin={race.stdin}
            output={output}
            pyodideStatus={python.status}
            busy={busy}
            hasProblem={Boolean(race.activeProblem)}
            onStdinChange={race.setStdin}
            onRun={runCode}
            onSubmit={submitSolution}
            onGiveUp={giveUp}
            onCancel={stopExecution}
          />
          <LeaderboardTicker racers={race.racers} events={race.events} simulated={simulated} />
        </aside>
      </main>

      <footer className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 pb-6 text-[11px] text-slate-700">
        <span>Problem bank {bank.version} · {bank.problems.length} challenge preview</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><Sparkles size={11} /> Code stays in this browser</span>
          {onExit && (
            <button type="button" onClick={onExit} className="flex items-center gap-1 text-slate-500 hover:text-white"><ArrowLeft size={12} /> Exit</button>
          )}
        </div>
      </footer>

      {solutionProblem && <SolutionModal problem={solutionProblem} onClose={() => setSolutionProblem(null)} />}
    </div>
  );
}

function LocalGame({ bank, onExit }: { bank: ProblemBank; onExit: () => void }) {
  const python = usePyodide();
  const race = useLocalRace(bank);
  const { confirm, notify } = useFeedback();
  const resetRace = async () => {
    const confirmed = await confirm({
      title: "Reset your solo race?",
      message: "Your score, solved challenges, code drafts, and simulated race progress will be cleared.",
      confirmLabel: "Reset race",
      tone: "danger",
    });
    if (confirmed) {
      race.reset();
      notify({ tone: "success", title: "Solo race reset", message: "A fresh trail is ready." });
    }
  };
  return (
    <GameShell
      bank={bank}
      race={race}
      python={python}
      simulated
      onReset={resetRace}
      onExit={onExit}
    />
  );
}

interface RoomPageProps {
  bank: ProblemBank;
  room: ReturnType<typeof useRaceRoom>;
  session: RoomSession;
}

function HostRoom({ room, session }: RoomPageProps) {
  const meta = room.meta!;
  const { confirm, notify } = useFeedback();
  const expire = useCallback(() => room.finishRace("time"), [room.finishRace]);
  const timeRemaining = useCountdown(meta, room.serverNow, expire);
  const closeRoom = async () => {
    const confirmed = await confirm({
      title: "Close this room?",
      message: "The room will close for every participant, and nobody will be able to rejoin it.",
      confirmLabel: "Close room",
      tone: "danger",
    });
    if (confirmed) {
      await room.closeRoom();
      notify({ tone: "info", title: "Room closed", message: "All participants have been disconnected." });
    }
  };

  if (meta.status === "lobby") {
    return (
      <RoomLobby
        role="host"
        code={session.code}
        players={room.players}
        durationSeconds={meta.durationSeconds}
        onDurationChange={room.setDuration}
        onStart={room.startRace}
        onLeave={() => void closeRoom()}
      />
    );
  }

  if (meta.status === "finished") {
    return (
      <RaceResults
        role="host"
        code={session.code}
        players={room.players}
        endReason={meta.endReason}
        onRematch={room.rematch}
        onClose={() => void closeRoom()}
      />
    );
  }

  return (
    <HostDashboard
      code={session.code}
      timeRemaining={timeRemaining}
      players={room.players}
      events={room.events}
      onStop={() => void room.finishRace("host")}
    />
  );
}

function PlayerRoom({ bank, room, session }: RoomPageProps) {
  const python = usePyodide();
  const meta = room.meta!;
  const expire = useCallback(() => room.finishRace("time"), [room.finishRace]);
  const timeRemaining = useCountdown(meta, room.serverNow, expire);

  useEffect(() => {
    if (meta.status === "lobby") {
      localStorage.removeItem(`col.draft.${session.code}.${session.uid}`);
      localStorage.removeItem(`pyclimb.draft.${session.code}.${session.uid}`);
      void room.setReady(python.status === "ready");
    }
  }, [meta.status, python.status, room.setReady, session.code, session.uid]);

  if (meta.status === "lobby") {
    return (
      <RoomLobby
        role="player"
        code={session.code}
        players={room.players}
        durationSeconds={meta.durationSeconds}
        pythonStatus={python.status}
        onRetryPython={python.retry}
        onLeave={() => void room.leaveRoom()}
      />
    );
  }

  if (meta.status === "finished") {
    return (
      <RaceResults
        role="player"
        code={session.code}
        players={room.players}
        endReason={meta.endReason}
        onLeave={() => void room.leaveRoom()}
      />
    );
  }

  return (
    <ActivePlayerGame
      bank={bank}
      room={room}
      session={session}
      python={python}
      timeRemaining={timeRemaining}
    />
  );
}

function ActivePlayerGame({
  bank,
  room,
  session,
  python,
  timeRemaining,
}: RoomPageProps & { python: PythonController; timeRemaining: string }) {
  const race = useMultiplayerRace({
    bank,
    session,
    players: room.players,
    progress: room.progress,
    events: room.events,
    recordSolve: room.recordSolve,
    recordForfeit: room.recordForfeit,
  });

  return (
    <GameShell
      bank={bank}
      race={race}
      python={python}
      roomCode={session.code}
      timeRemaining={timeRemaining}
    />
  );
}

function LoadedApp({ bank }: { bank: ProblemBank }) {
  const room = useRaceRoom(bank);
  const [soloTopics, setSoloTopics] = useState<CurriculumTopicId[] | null>(null);
  const [pinnedBank, setPinnedBank] = useState<ProblemBank | null>(null);
  const [pinnedBankError, setPinnedBankError] = useState<string | null>(null);

  useEffect(() => {
    const version = room.meta?.bankVersion;
    if (!version) {
      setPinnedBank(null);
      setPinnedBankError(null);
      return;
    }
    const scopeBank = (source: ProblemBank) => {
      const topics = parseTopicSelection(room.meta?.topicIds);
      return topics ? filterProblemBankByTopics(source, topics) : source;
    };
    if (version === bank.version) {
      setPinnedBank(scopeBank(bank));
      setPinnedBankError(null);
      return;
    }

    let cancelled = false;
    setPinnedBank(null);
    setPinnedBankError(null);
    loadProblemBank(version)
      .then((loadedBank) => {
        if (!cancelled) setPinnedBank(scopeBank(loadedBank));
      })
      .catch((reason) => {
        if (!cancelled) {
          setPinnedBankError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bank, room.meta?.bankVersion, room.meta?.topicIds]);

  if (soloTopics) {
    return (
      <LocalGame
        bank={filterProblemBankByTopics(bank, soloTopics)}
        onExit={() => setSoloTopics(null)}
      />
    );
  }
  if (!room.session) {
    return (
      <HomeScreen
        bank={bank}
        configured={room.configured}
        onSolo={setSoloTopics}
        onCreateRoom={async (topics) => {
          await room.createRoom(topics);
        }}
        onJoinRoom={async (code, nickname) => {
          await room.joinRoom(code, nickname);
        }}
      />
    );
  }
  if (room.loading) return <LoadingScreen />;
  if (!room.meta) {
    return (
      <LoadingScreen
        error={room.error ?? "The room could not be loaded."}
        onRetry={() => void room.leaveRoom()}
      />
    );
  }
  if (pinnedBankError) {
    return <LoadingScreen error={pinnedBankError} onRetry={() => void room.leaveRoom()} />;
  }
  if (!pinnedBank) return <LoadingScreen />;
  const page =
    room.session.role === "host" ? (
      <HostRoom bank={pinnedBank} room={room} session={room.session} />
    ) : (
      <PlayerRoom bank={pinnedBank} room={room} session={room.session} />
    );
  return (
    <>
      {!room.connected && (
        <div className="fixed inset-x-0 top-0 z-[60] bg-amber-300 px-4 py-2 text-center text-xs font-black text-amber-950 shadow-lg">
          Connection lost — your code is safe locally and the race will resync automatically.
        </div>
      )}
      {page}
    </>
  );
}

export default function App() {
  const [bank, setBank] = useState<ProblemBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadProblemBank()
      .then((loadedBank) => {
        if (!cancelled) setBank(loadedBank);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) return <LoadingScreen error={error} onRetry={() => setAttempt((value) => value + 1)} />;
  if (!bank) return <LoadingScreen />;
  return <LoadedApp bank={bank} />;
}
