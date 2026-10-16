import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import Image from "next/image";

type PhotoSlotProps = {
  label: string;
  className?: string;
  src?: string;
  alt?: string;
  sizes?: string;
};

export function PhotoSlot({ label, className, src, alt, sizes }: PhotoSlotProps) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-zinc-900", className)}>
        <Image
          src={src}
          alt={alt ?? label}
          fill
          {...(sizes ? { sizes } : {})}
          className="object-contain object-center"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden bg-zinc-950",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(196,16,46,0.22),transparent_58%)]" />
      <BrandLogo
        variant="mark"
        sizes="88px"
        alt=""
        className="relative w-20 opacity-40"
      />
      <p className="relative mt-3 px-3 text-center text-[0.65rem] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </p>
    </div>
  );
}
