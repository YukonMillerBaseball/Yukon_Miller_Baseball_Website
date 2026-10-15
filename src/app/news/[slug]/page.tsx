import { NewsPhoto } from "@/components/news-photo";
import { NewsStory } from "@/components/news-story";
import { buttonVariants } from "@/components/ui/button";
import { getArticle, articles } from "@/lib/news";
import { ogShareImage } from "@/lib/og-cover";
import { publicPageSeo } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return { title: "News" };
  }

  const image = ogShareImage(article.slug, article.image?.alt ?? article.title);
  const path = `/news/${article.slug}`;

  return {
    title: article.title,
    description: article.excerpt,
    ...publicPageSeo(path),
    openGraph: {
      ...publicPageSeo(path).openGraph,
      title: article.title,
      description: article.excerpt,
      type: "article",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [image.url],
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <article
      className={`mx-auto px-4 py-12 sm:px-6 ${
        article.blocks ? "max-w-4xl" : "max-w-3xl"
      }`}
    >
      <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
        {article.category} · {article.date}
      </p>
      <h1 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
        {article.title}
      </h1>
      {article.excerpt ? (
        <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-400">
          {article.excerpt}
        </p>
      ) : null}
      {article.image &&
      article.image.hero !== false &&
      article.image.size === "feature" ? (
        <div className="mt-8 md:grid md:grid-cols-[minmax(0,1fr)_minmax(14rem,38%)] md:items-start md:gap-8">
          <figure className="mx-auto w-full max-w-[14.5rem] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 md:order-2 md:mx-0 md:max-w-none">
            <Image
              src={article.image.src}
              alt={article.image.alt}
              width={article.image.width}
              height={article.image.height}
              priority
              className="h-auto w-full"
              sizes="(max-width: 768px) 14.5rem, 340px"
            />
          </figure>
          <div className="max-md:mt-8 md:order-1 [&>div]:mt-0">
            {article.blocks ? (
              <NewsStory blocks={article.blocks} />
            ) : (
              <div className="space-y-4 text-base leading-7 text-zinc-300">
                {article.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {article.image && article.image.hero !== false ? (
            <figure
              className={
                article.image.size === "half"
                  ? "mx-auto mt-8 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
                  : "mt-8 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
              }
            >
              {article.image.expand ? (
                <NewsPhoto
                  src={article.image.src}
                  alt={article.image.alt}
                  width={article.image.width}
                  height={article.image.height}
                  priority
                  sizes={
                    article.image.size === "half"
                      ? "(max-width: 384px) 100vw, 384px"
                      : "(max-width: 896px) 100vw, 896px"
                  }
                />
              ) : (
                <Image
                  src={article.image.src}
                  alt={article.image.alt}
                  width={article.image.width}
                  height={article.image.height}
                  priority
                  className="h-auto w-full"
                  sizes={
                    article.image.size === "half"
                      ? "(max-width: 384px) 100vw, 384px"
                      : "(max-width: 896px) 100vw, 896px"
                  }
                />
              )}
            </figure>
          ) : null}
          {article.blocks ? (
            <NewsStory blocks={article.blocks} />
          ) : (
            <div className="mt-8 space-y-4 text-base leading-7 text-zinc-300">
              {article.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          )}
        </>
      )}
      <Link
        href="/news"
        className={cn(buttonVariants({ variant: "outline" }), "mt-10 h-10 border-white/15 px-4")}
      >
        Back to news
      </Link>
    </article>
  );
}
