import { APP_NAME, CONTACT_EMAIL } from "@/lib/appInfo";

// Shared by the settings modal and the public /terms page. Sizes are relative
// so each host sets the base font size.

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 mt-3 text-[1.05em] font-semibold text-ink">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mb-2">{children}</p>;
}

export function TermsOfService() {
  return (
    <>
      <p className="m-0 mb-2 text-muted">Last updated: July 10, 2026</p>
      <H>The service</H>
      <P>
        {APP_NAME}{" "}is a free practice tool for looping and slowing down music. It is provided
        &quot;as is&quot;, without warranty of any kind; use it at your own risk. The service may
        change or be discontinued at any time.
      </P>
      <H>Your content</H>
      <P>
        You keep full ownership of the media you upload. You are responsible for having the rights
        to any content you use with the app; uploaded files are stored only to provide library
        sync and are never shared with anyone else.
      </P>
      <H>YouTube content</H>
      <P>
        YouTube playback goes through the official embedded player and is subject to
        YouTube&apos;s Terms of Service.
      </P>
      <H>Accounts</H>
      <P>
        Accounts are free. We may suspend or remove accounts that abuse the service. You can
        delete your account and all its data yourself at any time from the settings.
      </P>
      <p className="m-0 text-muted">
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </>
  );
}
