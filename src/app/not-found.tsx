import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
        404
      </p>
      <h1 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
        That page is not on the roster
      </h1>
      <p className="mt-4 text-sm leading-6 text-zinc-400">
        The link is wrong or the page moved. Head back to the Millers home
        page or jump to schedule, roster, or contact.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href="/" className={cn(buttonVariants(), "h-10 px-4")}>
          Home
        </Link>
        <Link
          href="/support#contact"
          className={cn(buttonVariants({ variant: "outline" }), "h-10 border-white/15 px-4")}
        >
          Contact
        </Link>
      </div>
    </div>
  );
}
