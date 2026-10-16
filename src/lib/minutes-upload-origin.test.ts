import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import { mediaRequestAllowed } from "@/lib/media-origin";
import {
  isAllowedDocument,
  isMinutesConflict,
  MAX_MINUTES_BYTES,
  MinutesConflictError,
  minutesWritePlan,
  safeMinutesName,
} from "@/lib/minutes-store";

type AuthMode = "admin" | "view" | "anonymous";

const calls = {
  auth: 0,
  find: 0,
  save: 0,
  uploadUrl: 0,
};

let authMode: AuthMode = "admin";
let currentRecord: { name: string; etag: string } | null = null;
let savedMode: { replace: boolean; etag?: string } | null = null;

function privateJson(body: unknown, init?: { status?: number }) {
  const response = Response.json(body, init);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

mock.module("@/lib/minutes-auth", {
  namedExports: {
    privateJson,
    async requireMinutes(options?: { admin?: boolean; adminError?: string }) {
      calls.auth += 1;
      if (authMode === "anonymous") {
        return {
          access: { state: "anonymous" as const },
          response: privateJson({ error: "Sign in required." }, { status: 401 }),
        };
      }
      if (authMode === "view" && options?.admin) {
        return {
          access: { state: "active" as const, role: "view" as const },
          response: privateJson(
            { error: options.adminError ?? "Admin sign-in required." },
            { status: 403 },
          ),
        };
      }
      return {
        access: { state: "active" as const, role: "admin" as const },
        response: null,
      };
    },
  },
});

mock.module("@/lib/minutes-store", {
  namedExports: {
    isAllowedDocument,
    isMinutesConflict,
    MAX_MINUTES_BYTES,
    MinutesConflictError,
    minutesWritePlan,
    safeMinutesName,
    async findMinutesRecord() {
      calls.find += 1;
      return currentRecord;
    },
    async saveMinutes(
      _name: string,
      _bytes: Uint8Array,
      mode: { replace: false } | { replace: true; etag: string },
    ) {
      calls.save += 1;
      savedMode = mode.replace ? { replace: true, etag: mode.etag } : { replace: false };
    },
    async listMinutesLibrary() {
      return { files: [], unavailable: false };
    },
    minutesUsesBlob() {
      return true;
    },
    async createMinutesUploadUrl(name: string) {
      calls.uploadUrl += 1;
      return { url: "https://upload.example/signed", name, contentType: "application/pdf" };
    },
  },
});

type PostRoute = (request: Request) => Promise<Response>;

let postMinutes: PostRoute;
let postUpload: PostRoute;
let getMinutes: () => Promise<Response>;

before(async () => {
  const minutes = await import("@/app/api/minutes/route");
  const upload = await import("@/app/api/minutes/upload/route");
  postMinutes = minutes.POST;
  getMinutes = minutes.GET;
  postUpload = upload.POST;
});

beforeEach(() => {
  calls.auth = 0;
  calls.find = 0;
  calls.save = 0;
  calls.uploadUrl = 0;
  authMode = "admin";
  currentRecord = null;
  savedMode = null;
});

function siteHeaders(origin?: string, host = "www.yukonbaseball.com") {
  const headers = new Headers();
  if (origin !== undefined) headers.set("origin", origin);
  if (host) headers.set("host", host);
  return headers;
}

function pdfForm(fields?: { replace?: boolean; etag?: string }) {
  const form = new FormData();
  form.set(
    "file",
    new File([new TextEncoder().encode("%PDF-1.4\n")], "Board Notes.pdf", {
      type: "application/pdf",
    }),
  );
  if (fields?.replace) {
    form.set("replace", "1");
    form.set("etag", fields.etag ?? "");
  }
  return form;
}

function minutesRequest(origin: string | undefined, fields?: { replace?: boolean; etag?: string }) {
  return new Request("https://www.yukonbaseball.com/api/minutes", {
    method: "POST",
    headers: siteHeaders(origin),
    body: pdfForm(fields),
  });
}

function uploadRequest(origin: string | undefined, host = "www.yukonbaseball.com") {
  const headers = siteHeaders(origin, host);
  headers.set("content-type", "application/json");
  return new Request("https://www.yukonbaseball.com/api/minutes/upload", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Board Notes.pdf", size: 12 }),
  });
}

describe("Meeting Minutes upload origin", () => {
  it("follows the Media Library rule for missing, invalid, and matching origins", () => {
    const url = "https://www.yukonbaseball.com/api/minutes";
    assert.equal(
      mediaRequestAllowed(new Request(url, { headers: { host: "www.yukonbaseball.com" } })),
      false,
    );
    assert.equal(
      mediaRequestAllowed(
        new Request(url, {
          headers: { origin: "not a url", host: "www.yukonbaseball.com" },
        }),
      ),
      false,
    );
    assert.equal(
      mediaRequestAllowed(
        new Request(url, {
          headers: { origin: "ftp://www.yukonbaseball.com", host: "www.yukonbaseball.com" },
        }),
      ),
      false,
    );
    assert.equal(
      mediaRequestAllowed(
        new Request(url, {
          headers: { origin: "https://www.yukonbaseball.com" },
        }),
      ),
      false,
    );
    assert.equal(
      mediaRequestAllowed(
        new Request(url, {
          headers: {
            origin: "https://www.yukonbaseball.com",
            host: "preview.example",
            "x-forwarded-host": "www.yukonbaseball.com, preview.example",
          },
        }),
      ),
      true,
    );
    assert.equal(
      mediaRequestAllowed(
        new Request(url, {
          headers: {
            origin: "https://WWW.YukonBaseball.com",
            host: "www.yukonbaseball.com",
          },
        }),
      ),
      true,
    );
    assert.equal(
      mediaRequestAllowed(
        new Request("http://127.0.0.1:43217/api/minutes", {
          headers: { origin: "http://127.0.0.1:43217", host: "127.0.0.1:43217" },
        }),
      ),
      true,
    );
  });

  it("saves a same-origin administrator upload and replacement", async () => {
    const created = await postMinutes(
      minutesRequest("https://www.yukonbaseball.com"),
    );
    assert.equal(created.status, 200);
    assert.equal(calls.auth, 1);
    assert.equal(calls.save, 1);
    assert.deepEqual(savedMode, { replace: false });

    currentRecord = { name: "Board Notes.pdf", etag: "etag-1" };
    const replaced = await postMinutes(
      minutesRequest("https://www.yukonbaseball.com", { replace: true, etag: "etag-1" }),
    );
    assert.equal(replaced.status, 200);
    assert.deepEqual(savedMode, { replace: true, etag: "etag-1" });
  });

  it("starts a same-origin direct upload for an administrator", async () => {
    const response = await postUpload(uploadRequest("https://www.yukonbaseball.com"));
    const body = (await response.json()) as { url?: string; name?: string };
    assert.equal(response.status, 200);
    assert.equal(body.name, "Board Notes.pdf");
    assert.equal(typeof body.url, "string");
    assert.equal(calls.uploadUrl, 1);
  });

  it("rejects a cross-origin upload before authorization or storage", async () => {
    const posted = await postMinutes(
      minutesRequest("https://weightgain.yukonbaseball.com"),
    );
    const postedBody = (await posted.json()) as { error?: string };
    assert.equal(posted.status, 403);
    assert.equal(postedBody.error, "Could not save that file.");
    assert.equal(calls.auth, 0);
    assert.equal(calls.find, 0);
    assert.equal(calls.save, 0);

    const uploaded = await postUpload(uploadRequest("https://evil.example"));
    assert.equal(uploaded.status, 403);
    assert.equal(calls.auth, 0);
    assert.equal(calls.uploadUrl, 0);
  });

  it("rejects a missing or invalid origin the same way", async () => {
    const missing = await postMinutes(minutesRequest(undefined));
    assert.equal(missing.status, 403);
    const invalid = await postUpload(uploadRequest("not a url"));
    assert.equal(invalid.status, 403);
    const otherHost = await postUpload(
      uploadRequest("https://www.yukonbaseball.com", "preview.example"),
    );
    assert.equal(otherHost.status, 403);
    assert.equal(calls.auth, 0);
    assert.equal(calls.save, 0);
    assert.equal(calls.uploadUrl, 0);
  });

  it("still requires an administrator after the origin check", async () => {
    authMode = "anonymous";
    const anonymous = await postMinutes(minutesRequest("https://www.yukonbaseball.com"));
    const anonymousBody = (await anonymous.json()) as { error?: string };
    assert.equal(anonymous.status, 401);
    assert.equal(anonymousBody.error, "Sign in required.");
    assert.equal(calls.save, 0);

    authMode = "view";
    const viewer = await postUpload(uploadRequest("https://www.yukonbaseball.com"));
    const viewerBody = (await viewer.json()) as { error?: string };
    assert.equal(viewer.status, 403);
    assert.equal(viewerBody.error, "Admin sign-in required to upload.");
    assert.equal(calls.uploadUrl, 0);
  });

  it("leaves document listing available without an origin header", async () => {
    const response = await getMinutes();
    assert.equal(response.status, 200);
    assert.equal(calls.auth, 1);
    assert.equal(calls.save, 0);
  });
});
