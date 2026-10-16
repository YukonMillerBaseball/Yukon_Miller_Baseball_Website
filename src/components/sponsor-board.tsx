import { buttonVariants } from "@/components/ui/button";
import {
  featuredSponsors,
  sponsorCount,
  sponsorshipForm,
  sponsorsByTier,
  sponsorTiers,
  type Sponsor,
  type SponsorTierId,
} from "@/lib/sponsors";
import { program } from "@/lib/site";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

function Mark({
  sponsor,
  size = "md",
}: {
  sponsor: Sponsor;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (sponsor.logo) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-xl bg-[#f4f1ea] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_0_0_1px_rgba(0,0,0,0.18)]",
          size === "sm" && "h-12 w-[5.5rem] shrink-0 p-1.5",
          size === "md" && "h-14 w-[6.75rem] shrink-0 p-2",
          size === "lg" && "h-[4.5rem] w-[9.5rem] shrink-0 p-2.5",
          size === "xl" && "h-32 w-full p-5 sm:h-36",
        )}
      >
        <Image
          src={sponsor.logo.src}
          alt=""
          width={sponsor.logo.width}
          height={sponsor.logo.height}
          className="h-auto max-h-full w-auto max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-red-950/80 via-zinc-950 to-black font-heading tracking-wide text-white uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        size === "sm" && "h-12 w-12 shrink-0 text-sm",
        size === "md" && "h-14 w-14 shrink-0 text-lg",
        size === "lg" && "h-[4.5rem] w-[4.5rem] shrink-0 text-2xl",
        size === "xl" && "h-32 w-full text-3xl sm:h-36",
      )}
      aria-hidden
    >
      {sponsor.mark}
    </div>
  );
}

function SponsorHref({ sponsor }: { sponsor: Sponsor }) {
  if (!sponsor.href) return null;

  return (
    <a
      href={sponsor.href}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute inset-0"
      aria-label={`${sponsor.name} (opens in a new tab)`}
    />
  );
}

function LeadSponsor({
  sponsor,
  kicker,
  presenting = false,
}: {
  sponsor: Sponsor;
  kicker: string;
  presenting?: boolean;
}) {
  return (
    <>
      <div className="sm:hidden">
        <p className="mb-3 text-[0.65rem] font-semibold tracking-[0.22em] text-red-400 uppercase">
          {kicker}
        </p>
        <SponsorTile sponsor={sponsor} featured />
      </div>
      <div className="hidden sm:block">
        {presenting ? (
          <article className="relative overflow-hidden rounded-2xl border border-red-700/40 bg-[linear-gradient(135deg,#2a0b12_0%,#0a0a0c_55%)] p-6 sm:p-10">
            <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-red-400 uppercase">
              {kicker}
            </p>
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
              <Mark sponsor={sponsor} size="lg" />
              <div>
                <h3 className="font-heading text-4xl leading-none tracking-wide text-white uppercase sm:text-6xl">
                  {sponsor.name}
                </h3>
              </div>
            </div>
            <SponsorHref sponsor={sponsor} />
          </article>
        ) : (
          <BannerPartner sponsor={sponsor} kicker={kicker} />
        )}
      </div>
    </>
  );
}

function BannerPartner({
  sponsor,
  kicker,
}: {
  sponsor: Sponsor;
  kicker: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(135deg,#1a1014_0%,#0a0a0c_55%)] p-6 sm:p-10">
      <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-red-400 uppercase">
        {kicker}
      </p>
      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
        <Mark sponsor={sponsor} size="lg" />
        <div>
          <h3 className="font-heading text-4xl leading-none tracking-wide text-white uppercase sm:text-5xl">
            {sponsor.name}
          </h3>
        </div>
      </div>
      <SponsorHref sponsor={sponsor} />
    </article>
  );
}

function SponsorTile({
  sponsor,
  featured = false,
}: {
  sponsor: Sponsor;
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 transition-colors hover:border-red-700/40",
        featured ? "p-7 sm:p-8" : "p-5",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-600/70 to-transparent" />
      <div
        className={cn(
          "flex",
          featured ? "flex-col items-stretch gap-5" : "items-center gap-4",
        )}
      >
        <Mark sponsor={sponsor} size={featured ? "xl" : "md"} />
        <div className="min-w-0 w-full">
          {sponsor.kicker ? (
            <p className="text-[0.62rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
              {sponsor.kicker}
            </p>
          ) : null}
          <h3
            className={cn(
              "font-heading text-white uppercase",
              featured
                ? "mt-1 text-2xl leading-none tracking-wide sm:text-3xl"
                : "mt-1 text-xl tracking-wide",
            )}
          >
            {sponsor.name}
          </h3>
        </div>
      </div>
      <SponsorHref sponsor={sponsor} />
    </article>
  );
}

function TierHead({
  tierId,
  showCopy = true,
}: {
  tierId: SponsorTierId;
  showCopy?: boolean;
}) {
  const tier = sponsorTiers.find((item) => item.id === tierId);
  if (!tier) return null;

  return (
    <div>
      {showCopy ? (
        <p className="text-[0.65rem] font-semibold tracking-[0.22em] text-red-400 uppercase">
          {tier.kicker}
        </p>
      ) : null}
      <h3
        className={cn(
          "font-heading tracking-wide text-white uppercase sm:text-3xl",
          showCopy ? "mt-1 text-2xl" : "text-2xl",
        )}
      >
        {tier.label}
      </h3>
      {showCopy ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {tier.blurb}
        </p>
      ) : null}
    </div>
  );
}

function TierBlock({
  tierId,
  featured = false,
  showCopy = true,
  columns,
}: {
  tierId: SponsorTierId;
  featured?: boolean;
  showCopy?: boolean;
  columns: string;
}) {
  const list = sponsorsByTier(tierId);
  if (list.length === 0) return null;

  return (
    <div>
      <TierHead tierId={tierId} showCopy={showCopy} />
      <div className={cn("mt-4 grid", featured ? "gap-4" : "gap-3", columns)}>
        {list.map((sponsor) => (
          <SponsorTile
            key={sponsor.id}
            sponsor={sponsor}
            featured={featured}
          />
        ))}
      </div>
    </div>
  );
}

export function SponsorBoard() {
  const presenting = sponsorsByTier("presenting");
  const scoreboard = sponsorsByTier("scoreboard");
  const cycle = sponsorsByTier("cycle");

  return (
    <div className="space-y-14">
      <section className="overflow-hidden rounded-2xl border border-white/12 bg-black">
        <header
          id="sponsorship-packet"
          className="relative overflow-hidden border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-heading text-3xl tracking-wide text-white uppercase sm:text-4xl">
                Partner with Yukon Baseball
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Partner with Yukon Baseball to support our players while
                putting your business in front of the Yukon community.
              </p>
              <a
                href={`mailto:${program.email}?subject=${encodeURIComponent("Yukon Baseball sponsorship")}`}
                className="mt-2.5 inline-block text-sm text-zinc-400 transition-colors hover:text-red-400"
              >
                Contact Yukon Baseball →
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Image
                src="/images/packet-heading-logo.png"
                alt="Yukon Millers"
                width={239}
                height={243}
                sizes="56px"
                className="size-12 shrink-0 sm:size-14"
              />
              <a
                href={sponsorshipForm.href}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants(), "h-11 px-5 uppercase")}
              >
                Sponsorship Form
              </a>
            </div>
          </div>
        </header>

        <div className="space-y-10 px-5 py-8 sm:px-8">
          {presenting.map((sponsor) => (
            <LeadSponsor
              key={sponsor.id}
              sponsor={sponsor}
              kicker="Presenting partner"
              presenting
            />
          ))}

          {scoreboard.map((sponsor) => (
            <LeadSponsor
              key={sponsor.id}
              sponsor={sponsor}
              kicker="Scoreboard · title partner"
            />
          ))}

          {cycle.map((sponsor) => (
            <LeadSponsor key={sponsor.id} sponsor={sponsor} kicker="The Cycle" />
          ))}
          <TierBlock
            tierId="grand-slam"
            featured
            showCopy={false}
            columns="md:grid-cols-3"
          />
          <TierBlock
            tierId="signature"
            featured
            showCopy={false}
            columns="md:grid-cols-3"
          />
        </div>
      </section>

      <TierBlock
        tierId="home-run"
        showCopy={false}
        columns="sm:grid-cols-2 lg:grid-cols-3"
      />
      <TierBlock
        tierId="triple"
        showCopy={false}
        columns="md:grid-cols-2"
      />
    </div>
  );
}

export function SponsorStrip() {
  return (
    <section className="border-b border-white/8 bg-black">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-red-400 uppercase">
              2026 partners
            </p>
            <h2 className="font-heading mt-2 text-3xl tracking-wide text-white uppercase">
              They back the Millers
            </h2>
          </div>
          <Link href="/sponsors" className="text-sm text-zinc-400 hover:text-white">
            See all {sponsorCount}
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {featuredSponsors.map((sponsor) => (
            <Link
              key={sponsor.id}
              href="/sponsors"
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950 px-3 py-5 text-center transition-colors hover:border-red-700/40"
            >
              <Mark sponsor={sponsor} size="md" />
              <div>
                {sponsor.kicker ? (
                  <p className="text-[0.58rem] font-semibold tracking-[0.18em] text-red-400 uppercase">
                    {sponsor.kicker}
                  </p>
                ) : null}
                <p className="font-heading text-sm leading-tight tracking-wide text-white uppercase">
                  {sponsor.name}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
