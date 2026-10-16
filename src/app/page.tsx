import { ArticleCardImage } from "@/components/article-card-image";
import { BrandLogo } from "@/components/brand-logo";
import { CommitTicker } from "@/components/commit-ticker";
import { TeamStoreBanner } from "@/components/team-store-banner";
import { buttonVariants } from "@/components/ui/button";
import { latestArticles } from "@/lib/news";
import { homeOgImage, ogImageSize } from "@/lib/og-cover";
import { publicPageSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

const homeShareImage = {
  url: homeOgImage,
  width: ogImageSize.width,
  height: ogImageSize.height,
  alt: "Yukon Miller Baseball — Home of the Millers",
};

export const metadata: Metadata = {
  ...publicPageSeo("/"),
  openGraph: {
    ...publicPageSeo("/").openGraph,
    title: "Yukon Miller Baseball",
    description:
      "Yukon High School Baseball. Home of the Millers. Schedule, roster, coaches, news, and Home Run Club.",
    type: "website",
    images: [homeShareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yukon Miller Baseball",
    description:
      "Yukon High School Baseball. Home of the Millers. Schedule, roster, coaches, news, and Home Run Club.",
    images: [homeShareImage.url],
  },
};

export default function HomePage() {
  const [featured, ...moreNews] = latestArticles(3);

  return (
    <div>
      <section className="relative -mt-14 overflow-hidden bg-black">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(200,16,46,0.16),transparent_55%)]" />
        <div className="relative mx-auto w-[min(92vw,52rem)] pt-14 sm:pt-16">
          <div className="relative">
            <div className="pointer-events-none">
              <BrandLogo
                variant="state"
                priority
                sizes="(max-width: 768px) 92vw, 832px"
                className="h-auto w-full opacity-[0.26]"
              />
              <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black via-black/45 to-transparent" />
            </div>
            <div className="relative z-10 -mt-[20%] flex flex-col items-center px-3 pb-0 text-center sm:-mt-[19%] sm:px-4">
              <p className="text-[0.62rem] font-semibold tracking-[0.22em] text-red-400 uppercase sm:text-[0.65rem] sm:tracking-[0.32em]">
                OSSAA Class 6A Baseball Program
              </p>
              <h1 className="font-heading mt-2 text-[2.75rem] leading-[0.9] text-white uppercase [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-7xl">
                Home of the Millers
              </h1>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Link
                  href="/roster"
                  className={cn(buttonVariants(), "h-10 min-w-[7.5rem] px-6 text-xs uppercase")}
                >
                  Players
                </Link>
                <Link
                  href="/news"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-10 min-w-[7.5rem] border-white/20 px-6 text-xs uppercase",
                  )}
                >
                  News
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-8 sm:px-6 sm:pb-10">
          <CommitTicker />
        </div>
      </section>

      <TeamStoreBanner />

      <section className="border-t border-white/8 bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.32em] text-red-400 uppercase">
                Latest
              </p>
              <h2 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-6xl">
                News
              </h2>
            </div>
            <Link
              href="/news"
              className="text-sm tracking-wide text-zinc-400 uppercase hover:text-white"
            >
              All stories
            </Link>
          </div>

          {featured ? (
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
              <Link
                href={`/news/${featured.slug}`}
                className="overflow-hidden rounded-2xl border border-white/12 bg-black transition-colors hover:border-red-700/40"
              >
                {featured.image ? (
                  <ArticleCardImage
                    image={featured.image}
                    variant="banner"
                    sizes="(max-width: 1023px) calc(100vw - 2rem), 680px"
                    className="h-56 w-full object-cover sm:h-72"
                  />
                ) : null}
                <div className="p-8 sm:p-10">
                  <p className="text-[0.65rem] tracking-[0.2em] text-red-400 uppercase">
                    {featured.category}
                  </p>
                  <h3 className="font-heading mt-4 text-4xl leading-[0.92] tracking-wide text-white uppercase sm:text-5xl">
                    {featured.title}
                  </h3>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">
                    {featured.excerpt}
                  </p>
                </div>
              </Link>
              <div className="grid gap-4">
                {moreNews.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/news/${article.slug}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 transition-colors hover:border-red-700/40 lg:flex"
                  >
                    {article.image ? (
                      <div className="relative h-32 w-full shrink-0 lg:h-auto lg:w-36">
                        <ArticleCardImage
                          image={article.image}
                          sizes="(max-width: 1023px) calc(100vw - 2rem), 144px"
                          className="absolute inset-0 h-full w-full"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 p-5 sm:p-6">
                      <p className="text-[0.62rem] tracking-[0.18em] text-red-400 uppercase">
                        {article.category}
                      </p>
                      <h3 className="font-heading mt-2 text-2xl tracking-wide text-white uppercase">
                        {article.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-zinc-400">
                        {article.excerpt}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
