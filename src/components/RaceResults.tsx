import { Crown, DoorClosed, LogOut, RotateCcw, Trophy } from "lucide-react";
import type { RoomEndReason, RoomPlayer } from "../types/multiplayer";

interface RaceResultsProps {
  role: "host" | "player";
  code: string;
  players: RoomPlayer[];
  endReason: RoomEndReason;
  onRematch?: () => void;
  onClose?: () => void;
  onLeave?: () => void;
}

export function RaceResults({ role, code, players, endReason, onRematch, onClose, onLeave }: RaceResultsProps) {
  const reason = endReason === "completed" ? "A climber cleared the whole bank!" : endReason === "host" ? "The host stopped the race." : "Time is up!";
  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-300 text-amber-950 shadow-xl shadow-amber-500/20"><Trophy size={32} /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Room {code}</p>
          <h1 className="mt-2 text-3xl font-black text-white">Final standings</h1>
          <p className="mt-2 text-sm text-slate-500">{reason}</p>
        </div>
        <section className="panel mt-7 overflow-hidden">
          {players.map((player, index) => (
            <div key={player.uid} className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-3 border-b border-slate-800 px-5 py-4 last:border-0">
              <span className={`font-black ${index === 0 ? "text-amber-300" : "text-slate-600"}`}>{index + 1}</span>
              <span className="flex items-center gap-2 font-bold text-slate-200">{index === 0 && <Crown size={16} className="text-amber-300" />}{player.nickname}</span>
              <span className="text-xs text-slate-500">{player.correctCount} solved</span>
              <strong className="w-16 text-right font-mono text-white">{player.score}</strong>
            </div>
          ))}
        </section>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {role === "host" ? (
            <>
              <button type="button" onClick={onRematch} className="flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-black text-slate-950"><RotateCcw size={16} /> Rematch</button>
              <button type="button" onClick={onClose} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-rose-300"><DoorClosed size={16} /> Close room</button>
            </>
          ) : (
            <button type="button" onClick={onLeave} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300"><LogOut size={16} /> Leave room</button>
          )}
        </div>
      </div>
    </main>
  );
}
