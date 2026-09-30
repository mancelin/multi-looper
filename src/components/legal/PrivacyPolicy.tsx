import { CONTACT_EMAIL } from "@/lib/appInfo";

// Shared by the settings modal and the public /privacy page (linked from the
// Play Store listing). Sizes are relative so each host sets the base font size.

export const PRIVACY_UPDATED = "September 30, 2026";

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 mt-3 text-[1.05em] font-semibold text-ink">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mb-2">{children}</p>;
}

export function PrivacyPolicy() {
  return (
    <>
      <p className="m-0 mb-2 text-muted">Last updated: {PRIVACY_UPDATED}</p>
      <P>
        This policy covers multi-looper on the web (multi-looper.com) and the Android app. It is
        the same for both.
      </P>
      <H>Data stored on your device</H>
      <P>
        As a guest, everything stays on your device: your library (tracks, loops, settings) lives
        in the app&apos;s local storage, and local media files and recordings are kept in its
        IndexedDB. Nothing is sent anywhere.
      </P>
      <H>Microphone</H>
      <P>
        The microphone is used only while the record dialog is open, to capture the takes you
        record. A take is treated like any other local file: it stays on your device, or is
        uploaded to your account if you are signed in. Audio is never analysed or shared.
      </P>
      <H>Data stored with an account</H>
      <P>
        If you create an account, we store your email address, a hashed password, your library
        (track metadata and loop positions) and any media files and recordings you upload, solely
        to sync your library across devices. If you sign in with Google we receive your email
        address from Google; nothing else. Data is sent over an encrypted (HTTPS) connection.
      </P>
      <H>YouTube playback</H>
      <P>
        YouTube tracks play through the embedded YouTube player, which loads content from
        YouTube/Google. Their privacy policy applies to that playback.
      </P>
      <H>What we don&apos;t do</H>
      <P>
        No analytics, no ads, no tracking cookies. Your data is never sold or shared with third
        parties.
      </P>
      <H>Deleting your data</H>
      <P>
        Settings → &quot;Delete all data&quot; removes every track (local and synced) and keeps
        the account. &quot;Delete account&quot; permanently removes your account and everything
        stored with it. See <a href="https://multi-looper.com/delete-account">
          multi-looper.com/delete-account
        </a>{" "}
        for the steps.
      </P>
      <p className="m-0 text-muted">
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  );
}
