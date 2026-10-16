import { privateJson, privateNoStore, requireMinutes } from "@/lib/minutes-auth";
import { applyProtectedFileHeaders } from "@/lib/security-headers";
import {
  createMinutesDownloadUrl,
  deleteMinutes,
  minutesUsesBlob,
  openMinutes,
  readMinutes,
  safeMinutesName,
} from "@/lib/minutes-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fileNameFrom(request: Request) {
  const url = new URL(request.url);
  return safeMinutesName(url.searchParams.get("name") ?? "");
}

function wantsInlinePdf(request: Request) {
  return new URL(request.url).searchParams.get("inline") === "1";
}

function isPdfName(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

async function inlinePdf(name: string) {
  if (!isPdfName(name)) {
    return privateJson(
      { error: "Only PDF files can be previewed." },
      { status: 400 },
    );
  }

  const file = await openMinutes(name);
  if (!file) {
    return privateJson({ error: "File not found." }, { status: 404 });
  }

  return applyProtectedFileHeaders(privateNoStore(new NextResponse(file.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  })));
}

export async function GET(request: Request) {
  const { response } = await requireMinutes();
  if (response) return response;

  const name = fileNameFrom(request);
  if (!name) {
    return privateJson({ error: "Invalid file name." }, { status: 400 });
  }

  if (wantsInlinePdf(request)) {
    return inlinePdf(name);
  }

  if (minutesUsesBlob()) {
    try {
      const url = await createMinutesDownloadUrl(name);
      return applyProtectedFileHeaders(privateNoStore(NextResponse.redirect(url, 302)));
    } catch {
      // Fall through to a proxied download.
    }
  }

  const bytes = await readMinutes(name);
  if (!bytes) {
    return privateJson({ error: "File not found." }, { status: 404 });
  }

  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  const type =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === ".doc"
          ? "application/msword"
          : "application/octet-stream";

  return applyProtectedFileHeaders(privateNoStore(new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  })));
}

export async function DELETE(request: Request) {
  const { response } = await requireMinutes({
    admin: true,
    touch: true,
    adminError: "Admin sign-in required to remove files.",
  });
  if (response) return response;

  const name = fileNameFrom(request);
  if (!name) {
    return privateJson({ error: "Invalid file name." }, { status: 400 });
  }

  await deleteMinutes(name);
  return privateJson({ ok: true });
}
