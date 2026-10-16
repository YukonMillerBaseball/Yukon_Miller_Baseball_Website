import { ArticleCardImage } from "@/components/article-card-image";
import { PageHero } from "@/components/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { archivedArticles } from "@/lib/news";
import { newsIndexOgImage, ogImageSize } from "@/lib/og-cover";
import { publicPageSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

const newsShareImage = {
  url: newsIndexOgImage,
  width: ogImageSize.width,
  height: ogImageSize.height,
  alt: "More Yukon Miller Baseball news",
};

export const metadata: Metadata = {
  title: "More news",
  description: "More Yukon Miller Baseball stories, commits, and program updates.",
  ...publicPageSeo("/news/archive"),
  openGraph: {
    ...publicPageSeo("/news/archive").openGraph,
    title: "More news",
    description: "More Yukon Miller Baseball stories, commits, and program updates.",
    images: [newsShareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [newsShareImage.url],
  },
};

export default function NewsArchivePage() {
  const stories = archivedArticles();

  return (
    <div>
      <PageHero
        kicker="Updates"
        title="More news"
        lede="More Yukon Miller Baseball stories, commits, and program updates."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {stories.length === 0 ? (
          <p className="text-sm leading-6 text-zinc-400">
            Every posted story is still on the news page.
          </p>
        ) : (
          <ul className="space-y-3">
            {stories.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/news/${article.slug}`}
                  className="block rounded-2xl border border-white/10 bg-zinc-950 p-4 hover:border-red-700/50 sm:flex sm:items-center sm:gap-5 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] tracking-[0.18em] text-red-400 uppercase">
                      {article.category} · {article.date}
                    </p>
                    <h2 className="font-heading mt-2 text-xl tracking-wide text-white uppercase">
                      {article.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {article.excerpt}
                    </p>
                  </div>
                  {article.image ? (
                    <ArticleCardImage
                      image={article.image}
                      variant="card"
                      sizes="(max-width: 639px) calc(100vw - 4rem), 128px"
                      className="mt-4 h-32 w-full rounded-xl object-cover sm:mt-0 sm:h-24 sm:w-32 sm:shrink-0"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/news"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "mt-8 h-10 border-white/15 px-4 uppercase",
          )}
        >
          Back to news
        </Link>
      </div>
    </div>
  );
}
