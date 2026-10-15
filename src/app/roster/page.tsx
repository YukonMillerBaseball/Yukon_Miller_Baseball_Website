import { RosterBoard } from "@/components/roster-board";
import { PageHero } from "@/components/page-hero";
import { publicPageSeo } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Roster", ...publicPageSeo("/roster") };

export default function RosterPage() {
  return (
    <div>
      <PageHero kicker="Players" title="Roster" className="pb-0 sm:pb-0" />
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-6">
        <RosterBoard />
      </div>
    </div>
  );
}
