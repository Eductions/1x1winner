import Link from "next/link";
import { Building2, LogIn, PlayCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm text-slate-300">
        <Building2 className="h-4 w-4 text-amber-300" />
        Gamified English for university students
      </div>

      <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
        Tower of <span className="text-amber-300">English</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
        Two teams race up a ten-floor tower. Every correct English answer
        climbs one floor in real time — first team to the summit takes the
        crown and the badges.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-8 py-4 font-black text-slate-950 transition hover:bg-amber-300"
        >
          <LogIn className="h-5 w-5" />
          Sign in to play
        </Link>
        <Link
          href="/demo"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-8 py-4 font-bold text-slate-200 transition hover:bg-slate-800"
        >
          <PlayCircle className="h-5 w-5 text-sky-400" />
          Try the interactive demo
        </Link>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Students sign in with the name and personal code provided by their supervisor.
      </p>

      <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
        {[
          {
            title: "Real-time races",
            body: "Supabase Realtime moves both team tokens the instant an answer lands.",
          },
          {
            title: "Fair by design",
            body: "Atomic Postgres RPCs serialise simultaneous answers — no race conditions.",
          },
          {
            title: "Celebrate the win",
            body: "Summit crowns, confetti and achievement badges at Floor 10.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <h2 className="font-black text-white">{card.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{card.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
