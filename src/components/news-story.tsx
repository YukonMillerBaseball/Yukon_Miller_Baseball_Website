import { NewsPhoto } from "@/components/news-photo";
import type { ArticleBlock } from "@/lib/news-blocks";
import Image from "next/image";

function Paragraph({ text }: { text: string }) {
  return <p className="text-base leading-7 text-zinc-300">{text}</p>;
}

export function NewsStory({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="mt-8 space-y-6">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "p") {
          return <Paragraph key={key} text={block.text} />;
        }

        if (block.type === "h2") {
          return (
            <h2
              key={key}
              className="font-heading pt-4 text-2xl tracking-wide text-white uppercase sm:text-3xl"
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={key} className="space-y-3 text-base leading-7 text-zinc-300">
              {block.items.map((item) => (
                <li
                  key={item}
                  className="border-l-2 border-red-700/70 pl-4 text-zinc-300"
                >
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={key}
              className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
            >
              {block.caption ? (
                <p className="border-b border-white/8 px-4 py-3 text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase sm:px-5">
                  {block.caption}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  {block.headers.some(Boolean) ? (
                    <thead>
                      <tr className="border-b border-white/8 text-[0.65rem] tracking-[0.16em] text-zinc-500 uppercase">
                        {block.headers.map((header) => (
                          <th key={header} className="px-4 py-3 font-medium sm:px-5">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {block.rows.map((row) => (
                      <tr
                        key={row.join("-")}
                        className="border-b border-white/6 last:border-0"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${row[0]}-${cellIndex}`}
                            className={`px-4 py-3 sm:px-5 ${
                              cellIndex === 0
                                ? "font-heading tracking-wide text-white uppercase"
                                : "text-zinc-300"
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        if (block.type === "scores") {
          return (
            <section
              key={key}
              className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
            >
              <p className="border-b border-white/8 px-5 py-3 text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
                {block.title}
              </p>
              <div className="grid gap-px bg-white/8 sm:grid-cols-3">
                {block.groups.map((group) => (
                  <div key={group.label} className="bg-zinc-950 px-5 py-5">
                    <p className="text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase">
                      {group.label}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-200">
                      {group.lines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (block.type === "rounds") {
          return (
            <div key={key} className="grid gap-3">
              {block.items.map((item) => (
                <article
                  key={item.kicker}
                  className="rounded-2xl border border-white/10 bg-zinc-950 px-5 py-5"
                >
                  <p className="text-[0.62rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
                    {item.kicker}
                  </p>
                  <h3 className="font-heading mt-2 text-xl tracking-wide text-white uppercase">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>
          );
        }

        if (block.type === "image") {
          const compact = block.size === "card";
          return (
            <figure
              key={key}
              className={
                compact
                  ? "mx-auto max-w-[16rem] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 sm:max-w-[18rem]"
                  : "overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
              }
            >
              {block.expand ? (
                <NewsPhoto
                  src={block.src}
                  alt={block.alt}
                  width={block.width}
                  height={block.height}
                  sizes={
                    compact
                      ? "(max-width: 640px) 16rem, 18rem"
                      : "(max-width: 896px) 100vw, 896px"
                  }
                />
              ) : (
                <Image
                  src={block.src}
                  alt={block.alt}
                  width={block.width}
                  height={block.height}
                  className="h-auto w-full"
                  sizes={
                    compact
                      ? "(max-width: 640px) 16rem, 18rem"
                      : "(max-width: 896px) 100vw, 896px"
                  }
                />
              )}
              {block.caption ? (
                <figcaption className="border-t border-white/8 px-4 py-3 text-sm text-zinc-400">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "people") {
          return (
            <div key={key} className="grid gap-4 sm:grid-cols-2">
              {block.items.map((person) => (
                <section
                  key={person.title}
                  className="rounded-2xl border border-white/10 bg-zinc-950 px-4 py-4"
                >
                  {person.image ? (
                    <figure className="mb-3 flex h-60 items-center justify-center overflow-hidden rounded-xl bg-black">
                      <Image
                        src={person.image.src}
                        alt={person.image.alt}
                        width={person.image.width}
                        height={person.image.height}
                        className="max-h-60 w-auto object-contain"
                        sizes="240px"
                      />
                    </figure>
                  ) : null}
                  <h2 className="font-heading text-xl tracking-wide text-white uppercase sm:text-2xl">
                    {person.title}
                  </h2>
                  <div className="mt-2 space-y-2">
                    {person.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-sm leading-6 text-zinc-300"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {person.note ? (
                    <p className="mt-3 rounded-xl border border-white/8 bg-black px-3 py-2 text-sm leading-6 text-zinc-500">
                      {person.note}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          );
        }

        if (block.type === "gallery") {
          return (
            <div
              key={key}
              className="grid gap-3 sm:grid-cols-2"
            >
              {block.photos.map((photo) => (
                <figure
                  key={photo.src}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
                >
                  {block.expand ? (
                    <NewsPhoto
                      src={photo.src}
                      alt={photo.alt}
                      width={photo.width}
                      height={photo.height}
                      sizes="(max-width: 768px) 100vw, 448px"
                    />
                  ) : (
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      width={photo.width}
                      height={photo.height}
                      className="h-auto w-full"
                      sizes="(max-width: 768px) 100vw, 448px"
                    />
                  )}
                  {photo.caption ? (
                    <figcaption className="border-t border-white/8 px-4 py-3 text-sm text-zinc-400">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          );
        }

        if (block.type === "glance") {
          return (
            <div key={key} className="grid gap-3">
              {block.items.map((item) => (
                <article
                  key={item.year}
                  className="rounded-2xl border border-white/10 bg-zinc-950 px-5 py-5"
                >
                  <p className="text-[0.62rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
                    {item.year}
                  </p>
                  <h3 className="font-heading mt-2 text-2xl tracking-wide text-white uppercase">
                    {item.team}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-200">{item.result}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {item.note}
                  </p>
                </article>
              ))}
            </div>
          );
        }

        return (
          <p
            key={key}
            className="rounded-2xl border border-white/8 bg-black px-5 py-4 text-sm leading-6 text-zinc-500"
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
