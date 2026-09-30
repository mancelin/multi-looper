import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { TermsOfService } from "@/components/legal/TermsOfService";

export const metadata: Metadata = { title: "Terms of service · multi-looper" };

export default function Page() {
  return (
    <LegalPage path="/terms" title="Terms of service">
      <TermsOfService />
    </LegalPage>
  );
}
