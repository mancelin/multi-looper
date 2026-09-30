import Link from "next/link";
import { APP_NAME } from "@/lib/appInfo";

/** The public legal pages, linked from each other, the home screen and the Play listing. */
export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/delete-account", label: "How to delete account" },
];

/** Standalone page shell for the public legal pages. */
export function LegalPage({
  path,
  title,
  children,
}: {
  path: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[680px] px-4 py-10 text-[14.5px] leading-[1.65] text-ink-3">
      <Link href="/" className="text-[13px] font-semibold tracking-wide">
        ← {APP_NAME}
      </Link>
      <h1 className="mb-4 mt-4 text-[26px] font-semibold text-ink">{title}</h1>
      {children}
      <nav
        aria-label="Legal"
        className="mt-10 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/8 pt-4 text-[13px]"
      >
        {LEGAL_LINKS.filter((l) => l.href !== path).map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
