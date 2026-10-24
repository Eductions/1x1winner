import Link from "next/link";
import { SetupSupervisorForm } from "@/components/SetupSupervisorForm";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-3xl font-black tracking-tight text-white">
        Tower of <span className="text-amber-300">English</span>
      </Link>
      <SetupSupervisorForm />
      <Link
        href="/login"
        className="mt-6 text-sm font-semibold text-sky-400 hover:text-sky-300"
      >
        Already have a name and code? Sign in →
      </Link>
    </main>
  );
}
