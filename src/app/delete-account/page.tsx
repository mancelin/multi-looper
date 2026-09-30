import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { APP_NAME, AUTHOR_NAME, CONTACT_EMAIL } from "@/lib/appInfo";

export const metadata: Metadata = { title: "Delete your account · multi-looper" };

// Linked from the Play Store listing's "delete account" URL: it must say how to
// delete from inside the app AND offer a way that works without the app.

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1 mt-6 text-[17px] font-semibold text-ink">{children}</h2>;
}

export default function Page() {
  const mail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Delete my ${APP_NAME} account`)}`;
  return (
    <LegalPage title="Delete your account">
      <p className="m-0 mb-2">
        How to delete your {APP_NAME} account and its data (app by {AUTHOR_NAME}). This works the
        same on the web and in the Android app.
      </p>

      <H>From the app</H>
      <ol className="m-0 mb-2 list-decimal pl-6">
        <li>Sign in to the account you want to delete.</li>
        <li>Open Settings (gear icon, top right).</li>
        <li>Tap &quot;Delete account&quot;, then confirm.</li>
      </ol>
      <p className="m-0 mb-2">The deletion is immediate.</p>

      <H>Without the app</H>
      <p className="m-0 mb-2">
        Email <a href={mail}>{CONTACT_EMAIL}</a> from the address you signed up with, asking for
        your account to be deleted. We delete it within 7 days and reply to confirm.
      </p>

      <H>What gets deleted</H>
      <ul className="m-0 mb-2 list-disc pl-6">
        <li>Your account: email address and hashed password (or Google sign-in link).</li>
        <li>Your synced library: tracks, loops and extra media (images, notes).</li>
        <li>Every media file and recording you uploaded.</li>
      </ul>
      <p className="m-0 mb-2">
        Nothing is kept. Server backups containing your data are rotated out within 14 days.
      </p>

      <H>Deleting data but keeping the account</H>
      <p className="m-0 mb-2">
        Settings → &quot;Delete all data&quot; removes every track (synced and local) and keeps
        the account.
      </p>

      <H>Guest mode</H>
      <p className="m-0 mb-2">
        Without an account nothing leaves your device. Settings → &quot;Delete all data&quot;, or
        uninstalling the app / clearing the site&apos;s data, removes it all.
      </p>

      <p className="m-0 mt-6 text-muted">
        See also the <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
