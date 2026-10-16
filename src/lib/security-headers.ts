/**
 * Browser headers for YukonBaseball.com.
 *
 * HSTS is set by Vercel and is intentionally absent here.
 * The content security policy is report-only: browsers log violations
 * and still load the page. There is no report endpoint.
 *
 * script-src does not allow 'unsafe-inline' or 'unsafe-eval'. Next.js
 * inline bootstrap scripts will show report-only console warnings until
 * a nonce policy is approved. Those warnings do not block the scripts.
 *
 * style-src allows 'unsafe-inline' because existing image and icon
 * components set style attributes. Google fonts are self-hosted by next/font.
 */

export const CONTENT_TYPE_OPTIONS = {
  key: "X-Content-Type-Options",
  value: "nosniff",
} as const;

export const REFERRER_POLICY = {
  key: "Referrer-Policy",
  value: "strict-origin-when-cross-origin",
} as const;

export const PRIVATE_REFERRER_POLICY = {
  key: "Referrer-Policy",
  value: "no-referrer",
} as const;

export const PERMISSIONS_POLICY = {
  key: "Permissions-Policy",
  value: [
    "accelerometer=()",
    "bluetooth=()",
    "browsing-topics=()",
    "camera=()",
    "display-capture=()",
    "geolocation=()",
    "gyroscope=()",
    "hid=()",
    "interest-cohort=()",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "serial=()",
    "usb=()",
  ].join(", "),
} as const;

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = {
  key: "Content-Security-Policy-Report-Only",
  value: [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "script-src 'self' https://www.googletagmanager.com https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://www.google-analytics.com https://www.googletagmanager.com",
    "font-src 'self'",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://vitals.vercel-insights.com",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; "),
} as const;

export const siteSecurityHeaders = [
  CONTENT_TYPE_OPTIONS,
  REFERRER_POLICY,
  PERMISSIONS_POLICY,
  CONTENT_SECURITY_POLICY_REPORT_ONLY,
];

export function applyProtectedFileHeaders(response: Response) {
  response.headers.set(CONTENT_TYPE_OPTIONS.key, CONTENT_TYPE_OPTIONS.value);
  response.headers.set(PRIVATE_REFERRER_POLICY.key, PRIVATE_REFERRER_POLICY.value);
  return response;
}
