import confetti from "canvas-confetti";
import {
  AlertTriangle,
  ArrowLeft,
  Bomb,
  History,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogo } from "./components/BrandLogo";
import { Console } from "./components/Console";
import { ChallengePanel } from "./components/ChallengePanel";
import { CollaborationNotebook } from "./components/CollaborationNotebook";
import { useFeedback } from "./components/Feedback";
import { HomeScreen } from "./components/HomeScreen";
import { HostDashboard } from "./components/HostDashboard";
import { LeaderboardTicker } from "./components/LeaderboardTicker";
import { Navbar } from "./components/Navbar";
import { ProblemHistory } from "./components/ProblemHistory";
import { ProfilePage } from "./components/ProfilePage";
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
import { getProblemBonus, getProblemReward } from "./data/problemProgression";
import type { Difficulty, Problem, ProblemBank } from "./data/problemTypes";
import { BOMB_PENALTY, TIMED_PROBLEM_SECONDS } from "./data/timedProblems";
import { useLocalRace } from "./hooks/useLocalRace";
import { useCollaborationRoom } from "./hooks/useCollaborationRoom";
import { useMultiplayerRace } from "./hooks/useMultiplayerRace";
import { usePyodide } from "./hooks/usePyodide";
import { useRaceRoom } from "./hooks/useRaceRoom";
import { compareOutput } from "./lib/judge";
import {
  readProblemHistory,
  rememberProblem,
  saveProblemHistory,
} from "./lib/problemHistory";
import { finishRaceHistory, recordRaceProblem } from "./lib/raceHistory";
import { formatCountdown, sortRoomPlayers } from "./lib/raceLogic";
import type { RaceActivity, RoomMeta, RoomSession } from "./types/multiplayer";
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
  codeShared?: boolean;
  roomCode?: string;
  timeRemaining?: string;
  historyRaceId?: string;
  onReset?: () => void;
  onExit?: () => void;
}

function GameShell({
  bank,
  race,
  python,
  simulated = false,
  codeShared = false,
  roomCode,
  timeRemaining,
  historyRaceId,
  onReset,
  onExit,
}: GameShellProps) {
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [solutionProblem, setSolutionProblem] = useState<Problem | null>(null);
  const [timedSeconds, setTimedSeconds] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"run" | "history">("run");
  const [problemHistoryIds, setProblemHistoryIds] = useState(readProblemHistory);
  const handledExpiry = useRef<string | null>(null);
  const { confirm, notify } = useFeedback();
  const activeProblemId = race.activeProblem?.id ?? null;

  useEffect(() => {
    if (!activeProblemId) return;
    if (historyRaceId) recordRaceProblem(historyRaceId, activeProblemId);
    setProblemHistoryIds((current) => {
      const next = rememberProblem(current, activeProblemId);
      saveProblemHistory(next);
      return next;
    });
  }, [activeProblemId, historyRaceId]);

  useEffect(() => {
    if (race.interactionReady === false) {
      setTimedSeconds(null);
      return;
    }
    const problem = race.activeProblem;
    if (!problem?.timedMode || !race.timedDeadline) {
      setTimedSeconds(null);
      handledExpiry.current = null;
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((race.timedDeadline! - Date.now()) / 1000));
      setTimedSeconds(remaining);
      if (remaining !== 0 || handledExpiry.current === problem.id) return;
      handledExpiry.current = problem.id;
      if (problem.timedMode === "bomb") {
        void Promise.resolve(race.expireTimedProblem?.(problem)).then(() => {
          setBusy(false);
          setOutput(`💥 Time expired. ${BOMB_PENALTY} points deducted.`);
          notify({
            tone: "error",
            title: "Speed timer expired",
            message: `${BOMB_PENALTY} points were deducted. Choose another climb when you're ready.`,
          });
        }).catch((reason) => {
          setOutput(`The speed timer expired, but the penalty could not be saved:\n${reason instanceof Error ? reason.message : String(reason)}`);
          notify({
            tone: "error",
            title: "Penalty could not be saved",
            message: "Check your connection, then give up this expired problem to continue.",
          });
        });
      } else {
        notify({
          tone: "warning",
          title: "2× window expired",
          message: "You can keep solving this problem for its normal point value.",
        });
      }
    };
    update();
    const intervalId = window.setInterval(update, 250);
    return () => window.clearInterval(intervalId);
  }, [
    notify,
    race.activeProblem,
    race.expireTimedProblem,
    race.interactionReady,
    race.timedDeadline,
  ]);

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
        await Promise.resolve(race.recordMiss?.(problem)).catch(() => undefined);
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

    const bonus = getProblemBonus(problem);
    try {
      const points = await race.solve(problem);
      if (historyRaceId) recordRaceProblem(historyRaceId, problem.id, true);
      const challengeWin = Boolean(race.headToHead);
      const doubled = !challengeWin && points === getProblemReward(problem) * 2;
      const rewardLabel = challengeWin
        ? " (head-to-head result)"
        : doubled
          ? " (2× timed bonus!)"
          : ` (${bonus} difficulty bonus)`;
      setOutput(`✓ All ${problem.testCases.length} tests passed!\n+${points} points${rewardLabel} — summit reached.`);
      notify({
        tone: "success",
        title: `+${points} points`,
        message: challengeWin
          ? `${problem.title} won the head-to-head race.`
          : doubled
          ? `${problem.title} completed before the deadline for double points.`
          : `${problem.title} completed with a +${bonus} difficulty bonus.`,
      });
      confetti({
        particleCount: 110,
        spread: 72,
        origin: { y: 0.68 },
        colors: ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa"],
      });
      if (!challengeWin && race.solvedIds.length + 1 === bank.problems.length) {
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
        onExit={onExit}
      />

      {race.activeProblem?.timedMode && timedSeconds !== null && (
        <div className={`mx-auto mt-4 flex max-w-[1560px] items-center justify-between rounded-xl border px-4 py-3 text-sm font-black ${
          race.activeProblem.timedMode === "bomb"
            ? "border-rose-400/40 bg-rose-400/10 text-rose-100"
            : "border-amber-400/40 bg-amber-400/10 text-amber-100"
        }`}>
          <span className="flex items-center gap-2">
            {race.activeProblem.timedMode === "bomb" ? <Bomb size={18} /> : <Zap size={18} />}
            {race.activeProblem.timedMode === "bomb" ? "Speed problem" : "⚡ 2× lightning problem"}
          </span>
          <span className="font-mono text-lg">{formatCountdown(timedSeconds)}</span>
        </div>
      )}

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
          <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
            <button
              type="button"
              onClick={() => setSidebarTab("run")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                sidebarTab === "run"
                  ? "bg-sky-400 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Terminal size={15} /> Run
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("history")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                sidebarTab === "history"
                  ? "bg-sky-400 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <History size={15} /> History
            </button>
          </div>
          {sidebarTab === "run" ? (
            <Console
              stdin={race.stdin}
              output={output}
              pyodideStatus={python.status}
              busy={busy}
              hasProblem={
                Boolean(race.activeProblem) &&
                race.interactionReady !== false
              }
              onStdinChange={race.setStdin}
              onRun={runCode}
              onSubmit={submitSolution}
              onGiveUp={giveUp}
              onCancel={stopExecution}
            />
          ) : (
            <ProblemHistory
              problems={bank.problems}
              historyIds={problemHistoryIds}
              activeProblemId={activeProblemId}
              solvedIds={race.solvedIds}
            />
          )}
          <LeaderboardTicker racers={race.racers} events={race.events} simulated={simulated} />
          {race.requestChallenge && (
            <ChallengePanel
              challenge={race.challenge ?? null}
              streak={race.currentStreak ?? 0}
              canChallenge={Boolean(race.canChallenge)}
              onChallenge={(difficulty) => {
                void race.requestChallenge?.(difficulty).catch((reason) => {
                  notify({
                    tone: "error",
                    title: "Challenge could not start",
                    message: reason instanceof Error ? reason.message : String(reason),
                  });
                });
              }}
            />
          )}
        </aside>
      </main>

      <footer className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 pb-6 text-[11px] text-slate-700">
        <span>Problem bank {bank.version} · {bank.problems.length} challenge preview</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Sparkles size={11} />
            {codeShared
              ? "The host and spectators can view your current code live"
              : "Code stays in this browser"}
          </span>
          {onExit && (
            <button type="button" onClick={onExit} className="flex items-center gap-1 text-slate-500 hover:text-white"><ArrowLeft size={12} /> Quit</button>
          )}
        </div>
      </footer>

      {solutionProblem && <SolutionModal problem={solutionProblem} onClose={() => setSolutionProblem(null)} />}
      {race.pendingProblem?.timedMode && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-5 backdrop-blur-sm">
          <section className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            race.pendingProblem.timedMode === "bomb"
              ? "border-rose-400/35 bg-[#1a0c16]"
              : "border-amber-400/35 bg-[#19150a]"
          }`}>
            <div className={`grid size-14 place-items-center rounded-2xl ${
              race.pendingProblem.timedMode === "bomb"
                ? "bg-rose-400/15 text-rose-300"
                : "bg-amber-400/15 text-amber-300"
            }`}>
              {race.pendingProblem.timedMode === "bomb" ? <Bomb size={28} /> : <Zap size={28} />}
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Timed problem ahead</p>
            <h2 className="mt-2 text-2xl font-black text-white">
              {race.pendingProblem.timedMode === "bomb" ? "Speed challenge" : "⚡ Lightning 2× sprint"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              You will have {formatCountdown(TIMED_PROBLEM_SECONDS[race.pendingProblem.difficulty])} once you start. {race.pendingProblem.timedMode === "bomb"
                ? `If time expires, the problem closes and you lose ${BOMB_PENALTY} points.`
                : "Finish before time expires to earn twice the normal points; afterward, you may continue for normal points."}
            </p>
            <button
              type="button"
              onClick={() => race.startPendingProblem?.()}
              disabled={race.interactionReady === false}
              className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-black text-slate-950 ${
                race.pendingProblem.timedMode === "bomb" ? "bg-rose-300" : "bg-amber-300"
              }`}
            >
              Start {formatCountdown(TIMED_PROBLEM_SECONDS[race.pendingProblem.difficulty])} timer
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function LocalGame({ bank, onExit }: { bank: ProblemBank; onExit: () => void }) {
  const python = usePyodide();
  const race = useLocalRace(bank);
  const { confirm, notify } = useFeedback();
  const historyRaceId = `solo:${race.startedAt}`;

  const archiveRace = () => {
    finishRaceHistory({
      id: historyRaceId,
      mode: "solo",
      label: "Solo practice",
      bankVersion: bank.version,
      startedAt: race.startedAt,
      score: race.score,
      rank: race.rank,
      playerCount: race.racers.length,
      solvedIds: race.solvedIds,
    });
  };

  const resetRace = async () => {
    const confirmed = await confirm({
      title: "Reset solo practice?",
      message: "Your score, solved challenges, code drafts, and simulated race progress will be cleared.",
      confirmLabel: "Reset race",
      tone: "danger",
    });
    if (confirmed) {
      archiveRace();
      race.reset();
      notify({ tone: "success", title: "Solo practice reset", message: "A fresh practice run is ready." });
    }
  };

  return (
    <GameShell
      bank={bank}
      race={race}
      python={python}
      simulated
      historyRaceId={historyRaceId}
      onReset={resetRace}
      onExit={() => {
        archiveRace();
        onExit();
      }}
    />
  );
}

interface RoomPageProps {
  bank: ProblemBank;
  room: ReturnType<typeof useRaceRoom>;
  session: RoomSession;
}

function HostRoom({ bank, room, session }: RoomPageProps) {
  const meta = room.meta!;
  const { confirm, notify } = useFeedback();
  const expire = useCallback(() => room.finishRace("time"), [room.finishRace]);
  const countdown = useCountdown(meta, room.serverNow, expire);
  const timeRemaining = meta.unlimited ? "Unlimited" : countdown;
  const closeRoom = async () => {
    const confirmed = await confirm({
      title: "Close this room?",
      message: "The room will close for every participant, and nobody will be able to rejoin it.",
      confirmLabel: "Close room",
      tone: "danger",
    });
    if (confirmed) {
      try {
        await room.closeRoom();
        notify({ tone: "info", title: "Room closed", message: "All participants have been disconnected." });
      } catch (reason) {
        notify({
          tone: "error",
          title: "Room was not closed",
          message: reason instanceof Error ? reason.message : String(reason),
        });
      }
    }
  };
  const makeSpectator = async (uid: string) => {
    const player = room.players.find((item) => item.uid === uid);
    if (!player) throw new Error("That contestant is no longer in the race.");
    const endsRace = meta.status === "active" && room.players.length === 1;
    const confirmed = await confirm({
      title: `Make ${player.nickname} a spectator?`,
      message: endsRace
        ? "Their score and placement will be removed. Because they are the final contestant, this will also end the race."
        : "Their current score and placement will be removed. They will stop competing and can view contestants' live code.",
      confirmLabel: "Make spectator",
      tone: "danger",
    });
    if (!confirmed) return;
    await room.makeSpectator(uid);
    notify({
      tone: "info",
      title: `${player.nickname} is spectating`,
      message: endsRace
        ? "They were the final contestant, so the race has ended."
        : "They have been removed from the standings and can now inspect live code.",
    });
  };
  const makePlayer = async (uid: string) => {
    const spectator = room.spectators.find((item) => item.uid === uid);
    if (!spectator) throw new Error("That spectator is no longer in the room.");
    const confirmed = await confirm({
      title: `Make ${spectator.nickname} a contestant?`,
      message:
        meta.status === "active"
          ? "They will rejoin the live standings with a fresh score and can immediately choose a problem."
          : "They will return to the contestant list and can ready up before the race starts.",
      confirmLabel: "Make contestant",
      tone: "primary",
    });
    if (!confirmed) return;
    await room.makePlayer(uid);
    notify({
      tone: "success",
      title: `${spectator.nickname} is competing`,
      message:
        meta.status === "active"
          ? "They have rejoined the live race with a fresh score."
          : "They can now load Python and ready up for the race.",
    });
  };

  if (meta.status === "lobby") {
    return (
      <RoomLobby
        role="host"
        code={session.code}
        players={room.players}
        spectators={room.spectators}
        durationSeconds={meta.durationSeconds}
        unlimited={Boolean(meta.unlimited)}
        onDurationChange={room.setDuration}
        onUnlimitedChange={(unlimited) => {
          void room.setUnlimited(unlimited).catch((reason) => {
            notify({
              tone: "error",
              title: "Room length was not changed",
              message: reason instanceof Error ? reason.message : String(reason),
            });
          });
        }}
        onStart={() => {
          void room.startRace().catch((reason) => {
            notify({
              tone: "error",
              title: "Race could not start",
              message: reason instanceof Error ? reason.message : String(reason),
            });
          });
        }}
        onMakeSpectator={makeSpectator}
        onMakePlayer={makePlayer}
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
        challengeSettlementPending={Boolean(
          room.challenge?.status === "finished" &&
            room.challenge.winnerUid,
        )}
        onRematch={() => {
          void room.rematch().catch((reason) => {
            notify({
              tone: "error",
              title: "Rematch is not ready",
              message: reason instanceof Error ? reason.message : String(reason),
            });
          });
        }}
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
      bank={bank}
      activities={room.activities}
      monitoringError={room.activityError}
      spectators={room.spectators}
      canManage
      onMakeSpectator={makeSpectator}
      onMakePlayer={makePlayer}
      onStop={() => void room.finishRace("host")}
    />
  );
}

function PlayerRoom({ bank, room, session }: RoomPageProps) {
  const python = usePyodide();
  const meta = room.meta!;
  const expire = useCallback(() => room.finishRace("time"), [room.finishRace]);
  const countdown = useCountdown(meta, room.serverNow, expire);
  const timeRemaining = meta.unlimited ? "Unlimited" : countdown;
  const historyRaceId = `room:${session.code}:${session.uid}:${meta.startedAt ?? meta.createdAt}`;

  useEffect(() => {
    if (meta.status !== "finished") return;
    const standings = sortRoomPlayers(room.players);
    const rank = standings.findIndex((player) => player.uid === session.uid) + 1;
    finishRaceHistory({
      id: historyRaceId,
      mode: "multiplayer",
      label: `Room ${session.code}`,
      bankVersion: meta.bankVersion,
      startedAt: meta.startedAt ?? meta.createdAt,
      finishedAt: meta.endedAt ?? Date.now(),
      score: room.progress.score,
      rank: rank || standings.length || 1,
      playerCount: standings.length,
      solvedIds: Object.keys(room.progress.solved ?? {}),
    });
  }, [historyRaceId, meta.bankVersion, meta.endedAt, meta.status, room.players, room.progress.score, room.progress.solved, session.code, session.uid]);

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
        spectators={room.spectators}
        durationSeconds={meta.durationSeconds}
        unlimited={Boolean(meta.unlimited)}
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
      historyRaceId={historyRaceId}
    />
  );
}

function SpectatorRoom({ bank, room, session }: RoomPageProps) {
  const meta = room.meta!;
  const ignoreExpiry = useCallback(() => undefined, []);
  const countdown = useCountdown(meta, room.serverNow, ignoreExpiry);
  const timeRemaining = meta.unlimited ? "Unlimited" : countdown;

  if (meta.status === "lobby") {
    return (
      <RoomLobby
        role="spectator"
        code={session.code}
        players={room.players}
        spectators={room.spectators}
        durationSeconds={meta.durationSeconds}
        unlimited={Boolean(meta.unlimited)}
        onLeave={() => void room.leaveRoom()}
      />
    );
  }

  if (meta.status === "finished") {
    return (
      <RaceResults
        role="spectator"
        code={session.code}
        players={room.players}
        endReason={meta.endReason}
        onLeave={() => void room.leaveRoom()}
      />
    );
  }

  return (
    <HostDashboard
      code={session.code}
      timeRemaining={timeRemaining}
      players={room.players}
      events={room.events}
      bank={bank}
      activities={room.activities}
      monitoringError={room.activityError}
      spectators={room.spectators}
      canManage={false}
      onLeave={() => void room.leaveRoom()}
    />
  );
}

function ActivePlayerGame({
  bank,
  room,
  session,
  python,
  timeRemaining,
  historyRaceId,
}: RoomPageProps & { python: PythonController; timeRemaining: string; historyRaceId: string }) {
  const race = useMultiplayerRace({
    bank,
    session,
    players: room.players,
    progress: room.progress,
    events: room.events,
    recordMiss: room.recordMiss,
    recordSolve: room.recordSolve,
    recordForfeit: room.recordForfeit,
    recordBombExpiry: room.recordBombExpiry,
    requestChallenge: room.requestChallenge,
    recordChallengeSolve: room.recordChallengeSolve,
    challenge: room.challenge,
    challengeLoaded: room.challengeLoaded,
  });
  const sharedActivityRef = useRef<Omit<RaceActivity, "updatedAt"> | null>(null);
  const sharedProblem = race.activeProblem ?? race.pendingProblem;
  sharedActivityRef.current = sharedProblem
    ? {
        problemId: sharedProblem.id,
        phase: race.activeProblem ? "active" : "pending",
        source: race.activeProblem ? race.editorCode : "",
      }
    : null;

  useEffect(() => {
    let acknowledgedProblemId: string | null | undefined;
    let acknowledgedPhase: RaceActivity["phase"] | null | undefined;
    let acknowledgedSource: string | null | undefined;
    let inFlight = false;
    const publish = () => {
      if (inFlight) return;
      const activity = sharedActivityRef.current;
      const problemId = activity?.problemId ?? null;
      const phase = activity?.phase ?? null;
      const source = activity?.source ?? null;
      if (
        problemId === acknowledgedProblemId &&
        phase === acknowledgedPhase &&
        source === acknowledgedSource
      ) {
        return;
      }
      inFlight = true;
      void room
        .publishActivity(activity)
        .then(() => {
          acknowledgedProblemId = problemId;
          acknowledgedPhase = phase;
          acknowledgedSource = source;
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };
    publish();
    const intervalId = window.setInterval(publish, 350);
    return () => {
      window.clearInterval(intervalId);
      void room.publishActivity(null).catch(() => undefined);
    };
  }, [room.publishActivity]);

  return (
    <GameShell
      bank={bank}
      race={race}
      python={python}
      codeShared
      roomCode={session.code}
      timeRemaining={timeRemaining}
      historyRaceId={historyRaceId}
    />
  );
}

function LoadedApp({ bank }: { bank: ProblemBank }) {
  const room = useRaceRoom(bank);
  const collaboration = useCollaborationRoom();
  const homeAuthUser = room.authUser ?? collaboration.authUser;
  const collaborationRelayHost = (import.meta.env.VITE_COLLAB_RELAY_HOST as string | undefined)?.trim() ?? "";
  const [soloTopics, setSoloTopics] = useState<CurriculumTopicId[] | null>(null);
  const [showProfile, setShowProfile] = useState(false);
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

  if (collaboration.session) {
    if (!collaborationRelayHost) {
      return (
        <LoadingScreen
          error="This build does not have a collaboration relay configured."
          onRetry={() => void collaboration.leaveRoom()}
        />
      );
    }
    if (collaboration.loading) return <LoadingScreen />;
    if (!collaboration.meta) {
      return (
        <LoadingScreen
          error={collaboration.error ?? "The collaboration room could not be loaded."}
          onRetry={() => void collaboration.leaveRoom()}
        />
      );
    }
    return (
      <CollaborationNotebook
        session={collaboration.session}
        relayHost={collaborationRelayHost}
        getIdToken={collaboration.getIdToken}
        onLeave={collaboration.leaveRoom}
      />
    );
  }
  if (soloTopics) {
    return (
      <LocalGame
        bank={filterProblemBankByTopics(bank, soloTopics)}
        onExit={() => setSoloTopics(null)}
      />
    );
  }
  if (showProfile && !room.session) {
    return <ProfilePage bank={bank} authUser={homeAuthUser} onBack={() => setShowProfile(false)} />;
  }
  if (!room.session) {
    return (
      <HomeScreen
        bank={bank}
        configured={room.configured}
        collaborationConfigured={collaboration.configured && Boolean(collaborationRelayHost)}
        collaborationError={collaboration.error}
        authUser={homeAuthUser}
        authLoading={room.authLoading || collaboration.authLoading}
        onSignIn={room.signIn}
        onSignOut={room.signOut}
        onProfile={() => setShowProfile(true)}
        onSolo={setSoloTopics}
        onCreateRoom={async (topics) => {
          await room.createRoom(topics);
        }}
        onJoinRoom={async (code, nickname) => {
          await room.joinRoom(code, nickname);
        }}
        onCreateCollaborationRoom={async () => {
          if (!homeAuthUser) await collaboration.signIn();
          await collaboration.createRoom();
        }}
        onJoinCollaborationRoom={async (code, nickname) => {
          await collaboration.joinRoom(code, nickname);
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
    ) : room.session.role === "spectator" ? (
      <SpectatorRoom bank={pinnedBank} room={room} session={room.session} />
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
