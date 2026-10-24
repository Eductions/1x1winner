import Link from "next/link";
import { LayoutDashboard, Swords } from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { SoundToggle } from "./SoundToggle";

interface AppHeaderProps {
  muted?: boolean;
  onToggleMute?: () => void;
}

export function AppHeader({ muted = false, onToggleMute }: AppHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
      <Link href="/" className="text-2xl font-black tracking-tight text-white">
        Tower of <span className="text-amber-300">English</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-2">
        <Link
          href="/lobby"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          <Swords className="h-4 w-4" /> Lobby
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
        >
          <LayoutDashboard className="h-4 w-4" /> Dashboard
        </Link>
        {onToggleMute && <SoundToggle muted={muted} onToggle={onToggleMute} />}
        <SignOutButton />
      </nav>
    </header>
  );
}
