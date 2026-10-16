import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT_SECURITY_POLICY_REPORT_ONLY,
  CONTENT_TYPE_OPTIONS,
  PERMISSIONS_POLICY,
  PRIVATE_REFERRER_POLICY,
  REFERRER_POLICY,
  applyProtectedFileHeaders,
  siteSecurityHeaders,
} from "@/lib/security-headers";

describe("browser security headers", () => {
  it("sets nosniff, a general referrer policy, and a locked-down permissions policy", () => {
    assert.equal(CONTENT_TYPE_OPTIONS.value, "nosniff");
    assert.equal(REFERRER_POLICY.value, "strict-origin-when-cross-origin");
    assert.equal(PRIVATE_REFERRER_POLICY.value, "no-referrer");
    for (const feature of [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
    ]) {
      assert.equal(PERMISSIONS_POLICY.value.includes(feature), true, feature);
    }
    const names = siteSecurityHeaders.map((header) => header.key) as string[];
    assert.equal(names.includes("Strict-Transport-Security"), false);
  });

  it("publishes a report-only content security policy without a reporting endpoint", () => {
    assert.equal(
      CONTENT_SECURITY_POLICY_REPORT_ONLY.key,
      "Content-Security-Policy-Report-Only",
    );
    const policy = CONTENT_SECURITY_POLICY_REPORT_ONLY.value;
    assert.equal(policy.includes("report-uri"), false);
    assert.equal(policy.includes("report-to"), false);
    assert.equal(policy.includes("'unsafe-eval'"), false);
    assert.equal(policy.includes("script-src 'self'"), true);
    assert.equal(/script-src [^;]*'unsafe-inline'/.test(policy), false);
    assert.equal(policy.includes("style-src 'self' 'unsafe-inline'"), true);
    assert.equal(policy.includes("https://www.googletagmanager.com"), true);
    assert.equal(policy.includes("https://www.google-analytics.com"), true);
    assert.equal(policy.includes("https://vitals.vercel-insights.com"), true);
    assert.equal(policy.includes("frame-src 'self'"), true);
    assert.equal(policy.includes("font-src 'self'"), true);
    const names = siteSecurityHeaders.map((header) => header.key) as string[];
    assert.equal(names.includes("Content-Security-Policy"), false);
  });

  it("marks protected file responses no-referrer and nosniff", () => {
    const response = new Response("ok");
    applyProtectedFileHeaders(response);
    assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  });
});
