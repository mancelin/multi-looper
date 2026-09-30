import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";

export const metadata: Metadata = { title: "Privacy policy · multi-looper" };

export default function Page() {
  return (
    <LegalPage path="/privacy" title="Privacy policy">
      <PrivacyPolicy />
    </LegalPage>
  );
}
