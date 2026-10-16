import type { NextConfig } from "next";
import {
  PRIVATE_REFERRER_POLICY,
  siteSecurityHeaders,
} from "./src/lib/security-headers";

const packetHeaders = [
  {
    key: "Content-Disposition",
    value: 'inline; filename="Yukon-Millers-Sponsorship-Packet-2026-2027.pdf"',
  },
  {
    key: "Content-Type",
    value: "application/pdf",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/@img/**/*",
      "./node_modules/sharp/**/*",
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "https://weightgain.yukonbaseball.com/dashboard",
        permanent: false,
      },
      {
        source: "/schedule-fields",
        destination: "/schedule",
        permanent: true,
      },
      {
        source: "/players-coaches",
        destination: "/roster",
        permanent: true,
      },
      {
        source: "/players",
        destination: "/roster",
        permanent: true,
      },
      {
        source: "/fields",
        destination: "/facilities",
        permanent: true,
      },
      {
        source: "/about",
        destination: "/coaches",
        permanent: true,
      },
      {
        source: "/info",
        destination: "/support",
        permanent: true,
      },
      {
        source: "/wallpapers",
        destination: "/media",
        permanent: true,
      },
      {
        source: "/contact",
        destination: "/support#contact",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: siteSecurityHeaders,
      },
      {
        source: "/api/minutes/file",
        headers: [PRIVATE_REFERRER_POLICY],
      },
      {
        source: "/api/media/cover",
        headers: [PRIVATE_REFERRER_POLICY],
      },
      {
        source: "/2026-2027-sponsorship-packet.pdf",
        headers: packetHeaders,
      },
      {
        source: "/2026-2027-sponsorship-form.pdf",
        headers: packetHeaders,
      },
      {
        source: "/minutes",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/media",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/media",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/media/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/minutes",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/minutes/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
