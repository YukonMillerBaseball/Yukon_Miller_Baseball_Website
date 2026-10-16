import { cn } from "@/lib/utils";

type PageHeroProps = {
  kicker?: string;
  title: string;
  lede?: string | string[];
  className?: string;
};

export function PageHero({ kicker, title, lede, className }: PageHeroProps) {
  const paragraphs = lede == null ? [] : Array.isArray(lede) ? lede : [lede];

  return (
    <header className="border-b border-white/8 bg-black">
      <div
        className={cn(
          "mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 sm:py-14 max-sm:min-h-[13.125rem]",
          className,
        )}
      >
        {kicker ? (
          <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
            {kicker}
          </p>
        ) : null}
        <h1 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
          {title}
        </h1>
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="mt-4 max-w-2xl text-base leading-7 text-zinc-400"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </header>
  );
}
