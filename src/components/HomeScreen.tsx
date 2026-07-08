import { ArrowRight, Gamepad2, LoaderCircle, Radio, Users } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "./BrandLogo";

interface HomeScreenProps {
  configured: boolean;
  onSolo: () => void;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (code: string, nickname: string) => Promise<void>;
}

export function HomeScreen({ configured, onSolo, onCreateRoom, onJoinRoom }: HomeScreenProps) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const perform = async (kind: "create" | "join", action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(null);
    }
  };

  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-center">
        <div className="mb-8 text-center">
          <BrandLogo
            alt="Col logo"
            className="mx-auto mb-4 size-20 rounded-2xl object-contain shadow-xl shadow-sky-500/20"
          />
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Col</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Race your classmates up a mountain of beginner Python challenges.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
                <Users size={21} />
              </div>
              <div>
                <h2 className="font-black text-white">Join a class race</h2>
                <p className="text-xs text-slate-500">Enter the code from your instructor.</p>
              </div>
            </div>
            <div className="space-y-3">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="ROOM CODE"
                aria-label="Room code"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-mono text-lg font-black tracking-[0.3em] text-white placeholder:text-sm placeholder:tracking-widest placeholder:text-slate-700"
              />
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value.slice(0, 20))}
                placeholder="Your nickname"
                aria-label="Nickname"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white placeholder:text-slate-700"
              />
              <button
                type="button"
                disabled={!configured || busy !== null}
                onClick={() => perform("join", () => onJoinRoom(code, nickname))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "join" ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                Join room
              </button>
            </div>
          </section>

          <section className="panel flex flex-col p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <Radio size={21} />
              </div>
              <div>
                <h2 className="font-black text-white">Instructor controls</h2>
                <p className="text-xs text-slate-500">Create a room and project the standings.</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!configured || busy !== null}
              onClick={() => perform("create", onCreateRoom)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "create" ? <LoaderCircle size={17} className="animate-spin" /> : <Users size={17} />}
              Create room
            </button>
            <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-700">
              <span className="h-px flex-1 bg-slate-800" /> or <span className="h-px flex-1 bg-slate-800" />
            </div>
            <button
              type="button"
              onClick={onSolo}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Gamepad2 size={17} /> Solo practice
            </button>
          </section>
        </div>

        {!configured && (
          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-center text-xs leading-5 text-amber-100/70">
            Multiplayer is disabled until the Firebase values from <code>.env.example</code> are added to <code>.env.local</code>.
            Solo Practice works now.
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-center text-sm font-semibold text-rose-200">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
