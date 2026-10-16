import type { ArticleImage } from "@/lib/news";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function ArticleCardImage({
  image,
  variant = "card",
  className,
  sizes,
}: {
  image: ArticleImage;
  variant?: "card" | "banner";
  className?: string;
  sizes?: string;
}) {
  const chosen =
    variant === "banner" && image.banner
      ? image.banner
      : variant === "card" && image.card
        ? image.card
        : image;

  return (
    <Image
      src={chosen.src}
      alt={image.alt}
      width={chosen.width}
      height={chosen.height}
      {...(sizes ? { sizes } : {})}
      className={cn("object-cover", className)}
      style={{ objectPosition: chosen.focus ?? image.focus ?? "center 22%" }}
    />
  );
}
