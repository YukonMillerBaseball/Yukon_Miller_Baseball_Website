import { privateJson, privateNoStore, requireMinutes } from "@/lib/minutes-auth";
import { applyProtectedFileHeaders } from "@/lib/security-headers";
import { isSafeCoverName } from "@/lib/media-catalog";
import { openMediaCover } from "@/lib/media-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await requireMinutes();
  if (response) return response;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isSafeCoverName(id)) {
    return privateJson({ error: "Cover not found." }, { status: 404 });
  }

  const cover = await openMediaCover(id);
  if (!cover) {
    return privateJson({ error: "Cover not found." }, { status: 404 });
  }

  return applyProtectedFileHeaders(privateNoStore(new NextResponse(cover.body, {
    headers: {
      "Content-Type": cover.contentType,
      "Content-Length": String(cover.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  })));
}
