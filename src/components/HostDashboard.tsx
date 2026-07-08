import { Clock3, Radio, Square } from "lucide-react";
import { LeaderboardTicker } from "./LeaderboardTicker";
import type { RoomPlayer } from "../types/multiplayer";
import type { RaceEvent, Racer } from "../types/race";

interface HostDashboardProps {
  code: string;
  timeRemaining: string;
  players: RoomPlayer[];
  events: RaceEvent[];
  onStop: () => void;
}

export function HostDashboard({ code, timeRemaining, players, events, onStop }: HostDashboardProps) {
  const racers: Racer[] = players.map((player) => ({ id: player.uid, name: player.nickname, score: player.score, online: player.online }));
  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"><Radio size={13} className="animate-pulse" /> Race live</p>
            <h1 className="mt-1 font-mono text-3xl font-black tracking-[0.22em] text-white">{code}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"><Clock3 size={18} className="text-sky-300" /><strong className="font-mono text-xl">{timeRemaining}</strong></div>
            <button type="button" onClick={onStop} className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-black text-rose-200 hover:bg-rose-400/20"><Square size={15} /> Stop now</button>
          </div>
        </header>
        <LeaderboardTicker racers={racers} events={events} />
      </div>
    </main>
  );
}
