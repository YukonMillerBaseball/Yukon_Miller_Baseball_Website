import { MinutesLogin } from "@/components/minutes-login";
import { MinutesSession } from "@/components/minutes-session";
import { PageHero } from "@/components/page-hero";
import { minutesAccess } from "@/lib/minutes-auth";
import { listMinutesLibrary } from "@/lib/minutes-store";
import { MINUTES_EXPIRED_MESSAGE, MINUTES_UNAVAILABLE_MESSAGE } from "@/lib/minutes-session";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meeting Minutes",
  robots: { index: false, follow: false },
};

export default async function MinutesPage() {
  const access = await minutesAccess();
  const library =
    access.state === "active"
      ? await listMinutesLibrary()
      : { files: [], unavailable: false };

  return (
    <div>
      <PageHero
        kicker="Home Run Club"
        title="Meeting Minutes"
        lede="Password-protected minutes for YUKON HS HOME RUN CLUB officers and coaching staff."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {access.state === "active" ? (
          <MinutesSession
            lastActivity={access.lastActivity}
            initialFiles={library.files}
            canAdmin={access.role === "admin"}
            documentsUnavailable={library.unavailable}
          />
        ) : (
          <MinutesLogin
            notice={
              access.state === "expired"
                ? MINUTES_EXPIRED_MESSAGE
                : access.state === "unavailable"
                  ? MINUTES_UNAVAILABLE_MESSAGE
                  : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
