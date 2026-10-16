import { OrganizationInfo } from "@/components/organization-info";
import { PageHero } from "@/components/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { hrc, officers, tcaStore } from "@/lib/support";
import { publicPageSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Home Run Club", ...publicPageSeo("/support") };

export default function SupportPage() {
  const meetings = hrc.howItRuns[0];
  const mailing = hrc.howItRuns[1];
  const venmo = hrc.howItRuns[2];

  return (
    <div>
      <PageHero kicker="Boosters" title="Home Run Club" lede={hrc.about} />

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:space-y-5 sm:px-6 sm:py-10">
        <section className="rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            Volunteer Opportunities
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Yukon Baseball needs volunteers through the season.{" "}
            {hrc.volunteerSignups.length > 0
              ? "Current signups are listed here."
              : "Signup links will be posted before the spring season."}
          </p>
          {hrc.volunteerSignups.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {hrc.volunteerSignups.map((opportunity) => (
                <li key={opportunity.href}>
                  <a
                    href={opportunity.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block font-heading text-xl tracking-wide text-red-400 uppercase underline decoration-red-400 decoration-2 underline-offset-8 transition-colors hover:text-red-300 hover:decoration-red-300"
                  >
                    {opportunity.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <OrganizationInfo />

        <section
          id="contact"
          className="scroll-mt-20 rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
              Leadership & Contact
            </h2>
            <a
              href={`mailto:${hrc.email}`}
              className={cn(buttonVariants(), "h-9 shrink-0 px-3 text-xs uppercase")}
            >
              Email YHRC
            </a>
          </div>
          <ul className="mt-5 space-y-2.5">
            {officers.map((officer) => (
              <li
                key={officer.name}
                className="flex items-baseline justify-between gap-4 text-sm"
              >
                <span className="text-white">{officer.name}</span>
                <span className="shrink-0 text-zinc-500">{officer.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            Meetings & Minutes
          </h2>
          <p className="mt-5 text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
            {meetings.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{meetings.body}</p>
          {meetings.note ? (
            <p className="mt-2 text-sm leading-6 text-zinc-400 italic">
              {`* ${meetings.note}`}
            </p>
          ) : null}
          <Link
            href="/minutes"
            className={cn(buttonVariants(), "mt-4 h-10 w-fit px-4")}
          >
            Meeting Minutes
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            {hrc.donations.title}
          </h2>
          <ul className="mt-5 space-y-2 text-sm">
            {hrc.memberships.map((membership) => (
              <li key={membership.name} className="flex justify-between gap-3">
                <span className="text-white">{membership.name}</span>
                <span className="text-zinc-300">{membership.price}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-6 text-zinc-400">{hrc.donations.body}</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
                {venmo.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{venmo.body}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
                {mailing.title}
              </p>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-zinc-400">
                {mailing.body}
              </p>
            </div>
          </div>
          <a
            href={hrc.venmoHref}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants(), "mt-6 h-10 w-fit px-4")}
          >
            Pay HRC Venmo
          </a>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            {tcaStore.name}
          </h2>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{tcaStore.blurb}</p>
          <a
            href={tcaStore.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-5 h-10 border-white/15 px-4",
            )}
          >
            Open TCA · code {tcaStore.code}
          </a>
        </section>
      </div>
    </div>
  );
}
