import { PageHero } from "@/components/page-hero";
import {
  clubhousePhotos,
  millerFieldHistory,
  parkFacts,
  parkPhotos,
  type FacilityPhoto,
} from "@/lib/facilities";
import { publicPageSeo } from "@/lib/seo";
import { program } from "@/lib/site";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Facilities",
  description:
    "Miller Field and the Yukon Miller Baseball clubhouse behind Yukon High School.",
  ...publicPageSeo("/facilities"),
};

function PhotoCard({
  photo,
  venue,
  priority = false,
}: {
  photo: FacilityPhoto;
  venue: string;
  priority?: boolean;
}) {
  const framed = photo.layout === "tile" || photo.layout === "portrait";
  const frameClass =
    photo.layout === "portrait" ? "relative aspect-[3/4]" : "relative aspect-[4/3]";

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
      {framed ? (
        <div className={frameClass}>
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </div>
      ) : (
        <Image
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          priority={priority}
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="h-auto w-full"
        />
      )}
      <figcaption className="flex items-center justify-between border-t border-white/8 px-4 py-3">
        <p className="font-heading text-sm tracking-wide text-white uppercase">
          {photo.caption}
        </p>
        <p className="text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase">
          {venue}
        </p>
      </figcaption>
    </figure>
  );
}

function PhotoGallery({
  photos,
  venue,
  priorityFirst = false,
}: {
  photos: FacilityPhoto[];
  venue: string;
  priorityFirst?: boolean;
}) {
  const groups: { layout: FacilityPhoto["layout"]; photos: FacilityPhoto[] }[] =
    [];

  for (const photo of photos) {
    const stacked = photo.layout === "tile" || photo.layout === "portrait";
    const last = groups[groups.length - 1];
    if (stacked && last && last.layout === photo.layout) {
      last.photos.push(photo);
    } else {
      groups.push({ layout: photo.layout, photos: [photo] });
    }
  }

  return (
    <div className="space-y-3">
      {groups.map((group, index) => {
        const first = index === 0;
        if (group.layout === "tile" || group.layout === "portrait") {
          return (
            <div key={`${group.layout}-${group.photos[0].id}`} className="grid gap-3 md:grid-cols-2">
              {group.photos.map((photo, photoIndex) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  venue={venue}
                  priority={priorityFirst && first && photoIndex === 0}
                />
              ))}
            </div>
          );
        }

        return (
          <PhotoCard
            key={group.photos[0].id}
            photo={group.photos[0]}
            venue={venue}
            priority={priorityFirst && first}
          />
        );
      })}
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <header className="mb-6">
      <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
        {kicker}
      </p>
      <h2 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
        {title}
      </h2>
    </header>
  );
}

export default function FacilitiesPage() {
  return (
    <div className="bg-black">
      <PageHero
        kicker="Our Home"
        title="Facilities"
        lede="A look inside the home of Yukon Miller Baseball."
      />

      <section>
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <SectionHeading kicker="Home field" title="Miller Field" />
          <div className="mt-6 max-w-3xl space-y-4">
            {millerFieldHistory.map((paragraph) => (
              <p key={paragraph} className="text-base leading-7 text-zinc-400">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 border-y border-white/8">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-white/8 lg:grid-cols-4">
            {parkFacts.map((fact) => (
              <div key={fact.label} className="bg-black px-4 py-5 sm:px-6 sm:py-6">
                <p className="text-[0.62rem] tracking-[0.2em] text-zinc-500 uppercase">
                  {fact.label}
                </p>
                <p className="mt-2 text-sm tracking-wide text-white sm:text-base">
                  {fact.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
          <PhotoGallery photos={parkPhotos} venue="Miller Field" priorityFirst />

          <article className="flex flex-col gap-4 border-t border-white/8 pt-10 sm:flex-row sm:items-end sm:justify-end">
            <div className="sm:text-right">
              <p className="text-sm leading-6 text-zinc-300">
                {program.street}
                <br />
                {program.cityStateZip}
              </p>
              <a
                href={program.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm tracking-wide text-red-400 uppercase hover:text-red-300"
              >
                Directions
              </a>
            </div>
          </article>
        </div>
      </section>

      <section className="border-t border-white/8">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <SectionHeading kicker="Inside" title="The Clubhouse" />
          <PhotoGallery photos={clubhousePhotos} venue="The Clubhouse" />
        </div>
      </section>
    </div>
  );
}
