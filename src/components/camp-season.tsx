import { buttonVariants } from "@/components/ui/button";
import type { CampSeason } from "@/lib/camps";
import { program } from "@/lib/site";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function CampSeasonDetails({ camp }: { camp: CampSeason }) {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-semibold tracking-[0.22em] text-red-400 uppercase">
              Posted flyer
            </p>
            <h2 className="font-heading mt-2 text-3xl tracking-wide text-white uppercase">
              {camp.title}
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{camp.ages}</p>
          </div>
          <a
            href={camp.registrationUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants(), "h-10 px-4 uppercase")}
          >
            Register now
          </a>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {camp.sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-xl tracking-wide text-white uppercase">
                  {session.name}
                </h3>
                <p className="text-sm text-red-400">{session.price}</p>
              </div>
              <p className="mt-2 text-sm text-zinc-300">
                {session.dates} · {session.time}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{session.cap}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          {camp.note} {camp.twoCampNote}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            Register
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            The flyer QR opens the same Google Form used for camp
            registration. Scan it or use the link — both go to the live
            form.
          </p>
          <div className="mt-6 flex flex-col items-start gap-6 sm:flex-row">
            <a
              href={camp.registrationUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-xl bg-white p-3"
            >
              <Image
                src={camp.qrSrc}
                alt={camp.qrAlt}
                width={196}
                height={196}
                className="h-44 w-44"
              />
            </a>
            <div className="min-w-0">
              <p className="text-[0.65rem] tracking-[0.18em] text-zinc-500 uppercase">
                QR destination
              </p>
              <a
                href={camp.registrationUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm leading-6 text-red-400 hover:text-red-300"
              >
                {camp.registrationUrl}
              </a>
              <a
                href={camp.registrationUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants(), "mt-4 h-10 px-4")}
              >
                Open registration form
              </a>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
            <h2 className="font-heading text-xl tracking-wide text-white uppercase">
              Location
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              {camp.location.name}
              <br />
              {camp.location.street}
              <br />
              {camp.location.cityStateZip}
              <br />
              {camp.location.detail}
            </p>
            <a
              href={program.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-red-400 hover:text-red-300"
            >
              Map to Miller Field
            </a>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
            <h2 className="font-heading text-xl tracking-wide text-white uppercase">
              Payment
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
              {camp.payment.methods.map((method) => (
                <li key={method}>{method}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-6 text-zinc-500">
              Questions go to Head Coach Ryan Phillips at{" "}
              <a
                className="text-red-400 hover:text-red-300"
                href={`mailto:${camp.coachEmail}`}
              >
                {camp.coachEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            The flyer
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Same sheet the program handed out. Download the PDF if you want a
            copy to text or print.
          </p>
          <a
            href={camp.pdfHref}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 h-10 border-white/15 px-4",
            )}
          >
            Download the flyer PDF
          </a>
        </div>
        <a
          href={camp.pdfHref}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded-2xl border border-white/10 bg-white"
        >
          <Image
            src={camp.flyerSrc}
            alt={camp.flyerAlt}
            width={1103}
            height={1426}
            className="h-auto w-full"
            sizes="(max-width: 1024px) 100vw, 640px"
          />
        </a>
      </section>
    </div>
  );
}
