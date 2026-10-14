import { CampSeasonDetails } from "@/components/camp-season";
import { PageHero } from "@/components/page-hero";
import {
  activeCamp,
  campsComingSoon,
  campsPageKicker,
  campsPageTitle,
} from "@/lib/camps";
import { defaultOgImage, ogImageSize } from "@/lib/og-cover";
import { publicPageSeo } from "@/lib/seo";
import type { Metadata } from "next";

const comingSoonDescription = `${campsComingSoon.headline} ${campsComingSoon.detail}`;

const shareImage = activeCamp
  ? {
      url: activeCamp.shareImage,
      width: ogImageSize.width,
      height: ogImageSize.height,
      alt: activeCamp.shareImageAlt,
    }
  : {
      url: defaultOgImage,
      width: ogImageSize.width,
      height: ogImageSize.height,
      alt: "Yukon Miller Baseball",
    };

export const metadata: Metadata = {
  title: campsPageTitle,
  description: activeCamp
    ? `${activeCamp.title} for ${activeCamp.ages} at ${activeCamp.location.name}. Dates, costs, and the live registration form.`
    : comingSoonDescription,
  ...publicPageSeo("/camps"),
  openGraph: {
    ...publicPageSeo("/camps").openGraph,
    title: activeCamp?.title ?? campsPageTitle,
    description: activeCamp?.shareDescription ?? comingSoonDescription,
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: activeCamp?.title ?? campsPageTitle,
    description: activeCamp?.shareDescription ?? comingSoonDescription,
    images: [shareImage.url],
  },
};

export default function CampsPage() {
  return (
    <div>
      <PageHero
        kicker={campsPageKicker}
        title={campsPageTitle}
        lede={
          activeCamp
            ? activeCamp.lede
            : [campsComingSoon.headline, campsComingSoon.detail]
        }
      />
      {activeCamp ? <CampSeasonDetails camp={activeCamp} /> : null}
    </div>
  );
}
