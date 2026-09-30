import Link from "next/link";
import { APP_NAME } from "@/lib/appInfo";

/** Standalone page shell for the public legal pages (/privacy, /delete-account). */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[680px] px-4 py-10 text-[14.5px] leading-[1.65] text-ink-3">
      <Link href="/" className="text-[13px] font-semibold tracking-wide">
        ← {APP_NAME}
      </Link>
      <h1 className="mb-4 mt-4 text-[26px] font-semibold text-ink">{title}</h1>
      {children}
    </main>
  );
}
