import { AnimatePresence, motion } from "framer-motion";
import { Activity, Medal, Radio } from "lucide-react";
import type { RaceEvent, Racer } from "../types/race";

interface LeaderboardTickerProps {
  racers: Racer[];
  events: RaceEvent[];
  simulated?: boolean;
}

export function LeaderboardTicker({ racers, events, simulated = false }: LeaderboardTickerProps) {
  const highestScore = Math.max(1, ...racers.map((racer) => Math.max(0, racer.score)));

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-700/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Medal size={17} className="text-amber-300" /> Live race
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <Radio size={12} className="animate-pulse" /> {simulated ? "simulated peers" : "live room"}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {racers.map((racer, index) => (
          <motion.div key={racer.id} layout className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2">
            <span className={`text-xs font-black ${index === 0 ? "text-amber-300" : "text-slate-600"}`}>
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className={`truncate font-bold ${racer.isUser ? "text-sky-200" : "text-slate-300"}`}>
                  {racer.name}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  initial={false}
                  animate={{ width: `${Math.max(0, racer.score) / highestScore * 100}%` }}
                  transition={{ type: "spring", stiffness: 130, damping: 20 }}
                  className={`h-full rounded-full ${racer.isUser ? "bg-sky-400" : "bg-violet-400"}`}
                />
              </div>
            </div>
            <motion.span layout className="w-12 text-right font-mono text-xs font-bold text-slate-400">
              {racer.score}
            </motion.span>
          </motion.div>
        ))}
      </div>

      <div className="border-t border-slate-800 bg-slate-950/35">
        <div className="flex items-center gap-2 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
          <Activity size={12} /> Race feed
        </div>
        <div className="h-32 overflow-y-auto px-4 pb-3">
          {events.length === 0 ? (
            <p className="text-xs leading-5 text-slate-700">The trail is quiet. Choose a climb to start the race.</p>
          ) : (
            <AnimatePresence initial={false}>
              {events.slice(0, 6).map((raceEvent) => (
                <motion.p
                  key={raceEvent.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`border-l py-1 pl-2 text-xs leading-5 ${
                    raceEvent.tone === "good"
                      ? "border-emerald-400/60 text-emerald-200"
                      : raceEvent.tone === "bad"
                        ? "border-rose-400/60 text-rose-200"
                        : "border-slate-700 text-slate-500"
                  }`}
                >
                  {raceEvent.message}
                </motion.p>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </section>
  );
}
