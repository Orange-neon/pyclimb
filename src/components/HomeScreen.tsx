import { ArrowRight, Gamepad2, LoaderCircle, LogIn, LogOut, Radio, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getDefaultTopicSelection, type CurriculumTopicId } from "../data/curriculum";
import type { ProblemBank } from "../data/problemTypes";
import { getFirebaseErrorMessage, type GoogleUserProfile } from "../lib/firebase";
import { BrandLogo } from "./BrandLogo";
import { TopicSelector } from "./TopicSelector";

interface HomeScreenProps {
  bank: ProblemBank;
  configured: boolean;
  authUser: GoogleUserProfile | null;
  authLoading: boolean;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onProfile: () => void;
  onSolo: (topics: CurriculumTopicId[]) => void;
  onCreateRoom: (topics: CurriculumTopicId[]) => Promise<void>;
  onJoinRoom: (code: string, nickname: string) => Promise<void>;
}

export function HomeScreen({
  bank,
  configured,
  authUser,
  authLoading,
  onSignIn,
  onSignOut,
  onProfile,
  onSolo,
  onCreateRoom,
  onJoinRoom,
}: HomeScreenProps) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [topics, setTopics] = useState<CurriculumTopicId[]>(() =>
    getDefaultTopicSelection(bank),
  );
  const [busy, setBusy] = useState<"auth" | "create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const perform = async (kind: "create" | "join", action: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(getFirebaseErrorMessage(reason));
      setBusy(null);
    }
  };

  useEffect(() => {
    if (authUser && !nickname) setNickname(authUser.displayName.slice(0, 20));
  }, [authUser, nickname]);

  const performAuth = async (action: () => Promise<void>) => {
    setBusy("auth");
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(getFirebaseErrorMessage(reason));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="grid-glow min-h-screen bg-[#070b16] px-4 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-center">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onProfile}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm font-bold text-slate-300 hover:border-sky-400/40 hover:text-white"
          >
            <UserRound size={16} /> Profile & history
          </button>
        </div>
        <div className="mb-8 text-center">
          <BrandLogo
            alt="Col logo"
            className="mx-auto mb-4 size-20 rounded-2xl object-contain shadow-xl shadow-sky-500/20"
          />
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Col</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Race your classmates through Python challenges that adapt as each student grows.
          </p>
        </div>

        <TopicSelector bank={bank} selected={topics} onChange={setTopics} />

        {configured && (
          <section className="panel mb-4 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {authUser?.photoURL ? (
                <img src={authUser.photoURL} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="grid size-10 place-items-center rounded-full bg-sky-400/10 text-sky-300">
                  <UserRound size={20} />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-white">
                  {authLoading ? "Checking sign-in…" : authUser ? authUser.displayName : "Google sign-in optional"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {authUser ? authUser.email : "Required only for unlimited rooms and cross-device resume."}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={authLoading || busy !== null}
              onClick={() => performAuth(authUser ? onSignOut : onSignIn)}
              className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5 text-sm font-black text-sky-200 disabled:opacity-40"
            >
              {busy === "auth" ? <LoaderCircle size={16} className="animate-spin" /> : authUser ? <LogOut size={16} /> : <LogIn size={16} />}
              {authUser ? "Sign out" : "Continue with Google"}
            </button>
          </section>
        )}

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
                Join or resume room
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
              onClick={() => perform("create", () => onCreateRoom(topics))}
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
              onClick={() => onSolo(topics)}
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
