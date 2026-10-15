import { RosterBoard } from "@/components/roster-board";
import { PageHero } from "@/components/page-hero";
import { publicPageSeo } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Roster", ...publicPageSeo("/roster") };

export default function RosterPage() {
  return (
    <div>
      <PageHero kicker="Players" title="Roster" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <RosterBoard />
      </div>
    </div>
  );
}
