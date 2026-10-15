import { ArticleCardImage } from "@/components/article-card-image";
import { EmptyState } from "@/components/empty-state";
import { PageHero } from "@/components/page-hero";
import { buttonVariants } from "@/components/ui/button";
import { archivedArticles, latestArticles, latestNewsLimit } from "@/lib/news";
import { newsIndexOgImage, ogImageSize } from "@/lib/og-cover";
import { publicPageSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";

const latestStories = latestArticles(latestNewsLimit);
const latestPhoto = latestStories.find((article) => article.image)?.image;
const newsShareImage = {
  url: newsIndexOgImage,
  width: ogImageSize.width,
  height: ogImageSize.height,
  alt: latestPhoto?.alt ?? "Yukon Miller Baseball news",
};

export const metadata: Metadata = {
  title: "News",
  description:
    "Yukon Miller Baseball news, commits, and program updates.",
  ...publicPageSeo("/news"),
  openGraph: {
    ...publicPageSeo("/news").openGraph,
    title: "News",
    description:
      "Yukon Miller Baseball news, commits, and program updates.",
    images: [newsShareImage],
  },
  twitter: {
    card: "summary_large_image",
    images: [newsShareImage.url],
  },
};

export default function NewsPage() {
  return (
    <div>
      <PageHero
        kicker="Updates"
        title="News"
        lede="News, announcements, and more from Yukon Baseball."
      />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {latestStories.length === 0 ? (
          <EmptyState
            title="No stories posted"
            body="The first update will be a real one. Weather and time changes also live here so parents are not hunting group texts."
          />
        ) : (
          <ul className="space-y-4">
            {latestStories.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/news/${article.slug}`}
                  className="block rounded-2xl border border-white/10 bg-zinc-950 p-6 hover:border-red-700/50 sm:flex sm:items-center sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] tracking-[0.18em] text-red-400 uppercase">
                      {article.category} · {article.date}
                    </p>
                    <h2 className="font-heading mt-2 text-2xl tracking-wide text-white uppercase">
                      {article.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {article.excerpt}
                    </p>
                  </div>
                  {article.image ? (
                    <ArticleCardImage
                      image={article.image}
                      variant="card"
                      className="mt-4 h-44 w-full rounded-xl object-cover sm:mt-0 sm:h-32 sm:w-40 sm:shrink-0"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {archivedArticles().length > 0 ? (
          <Link
            href="/news/archive"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-8 h-10 border-white/15 px-4 uppercase",
            )}
          >
            View more news
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
