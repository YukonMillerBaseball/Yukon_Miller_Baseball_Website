import { CoachesBoard } from "@/components/coaches-board";
import { PageHero } from "@/components/page-hero";
import { publicPageSeo } from "@/lib/seo";
import { program } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Coaches", ...publicPageSeo("/coaches") };

export default function CoachesPage() {
  return (
    <div>
      <PageHero
        kicker="Staff"
        title="Coaches"
        lede="Get to know the coaches leading Yukon Miller Baseball."
      />
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        <CoachesBoard />

        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
          <p className="text-sm leading-6 text-zinc-400">
            College coaches and families can reach the staff at{" "}
            <a
              className="text-red-400 hover:text-red-300"
              href={`mailto:${program.email}`}
            >
              {program.email}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
