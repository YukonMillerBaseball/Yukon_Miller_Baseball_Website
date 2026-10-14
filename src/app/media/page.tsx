import { MediaLibrary } from "@/components/media-library";
import { MinutesLogin } from "@/components/minutes-login";
import { MinutesSessionGuard } from "@/components/minutes-session-guard";
import { PageHero } from "@/components/page-hero";
import { emptyCatalog, toMediaCards } from "@/lib/media-catalog";
import { readMediaCatalog } from "@/lib/media-store";
import { minutesAccess } from "@/lib/minutes-auth";
import { MINUTES_EXPIRED_MESSAGE } from "@/lib/minutes-session";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Media",
  robots: { index: false, follow: false },
};

const loginDescription =
  "The Media Library and Meeting Minutes use the same password.";
const loginSubmitLabel = "Open library";

export default async function MediaPage() {
  const access = await minutesAccess();
  const read =
    access.state === "active" ? await readMediaCatalog() : null;
  const catalog = read?.status === "ready" ? read.catalog : emptyCatalog();

  return (
    <div>
      <PageHero
        kicker="Library"
        title="Media"
        lede="Shared photos, video, and albums for players, parents, and authorized members."
        className="py-5 sm:py-10"
      />
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-10">
        {access.state === "active" ? (
          <MinutesSessionGuard
            lastActivity={access.lastActivity}
            loginDescription={loginDescription}
            loginSubmitLabel={loginSubmitLabel}
          >
            <MediaLibrary
              key={`${catalog.version}:${read?.status ?? "signed-out"}`}
              version={catalog.version}
              items={toMediaCards(catalog)}
              canAdmin={access.role === "admin"}
              unavailable={read?.status === "unavailable"}
            />
          </MinutesSessionGuard>
        ) : (
          <MinutesLogin
            notice={access.state === "expired" ? MINUTES_EXPIRED_MESSAGE : undefined}
            description={loginDescription}
            submitLabel={loginSubmitLabel}
          />
        )}
      </div>
    </div>
  );
}
