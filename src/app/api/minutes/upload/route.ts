import { requireMinutes } from "@/lib/minutes-auth";
import {
  createMinutesUploadUrl,
  findMinutesRecord,
  isMinutesConflict,
  MAX_MINUTES_BYTES,
  MinutesConflictError,
  minutesUsesBlob,
  minutesWritePlan,
  safeMinutesName,
} from "@/lib/minutes-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function conflictResponse(name: string, etag: string) {
  return NextResponse.json(
    {
      exists: true,
      name,
      etag,
      error:
        "A document with this filename is already stored in Meeting Minutes.",
    },
    { status: 409 },
  );
}

export async function POST(request: Request) {
  const { response } = await requireMinutes({
    admin: true,
    touch: true,
    adminError: "Admin sign-in required to upload.",
  });
  if (response) return response;

  let body: { name?: unknown; size?: unknown; replace?: unknown; etag?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Choose a document." }, { status: 400 });
  }

  const size = typeof body.size === "number" ? body.size : Number(body.size);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Choose a document." }, { status: 400 });
  }
  if (size > MAX_MINUTES_BYTES) {
    return NextResponse.json(
      { error: "File must be 80 MB or smaller." },
      { status: 400 },
    );
  }

  const requested = safeMinutesName(typeof body.name === "string" ? body.name : "");
  if (!requested) {
    return NextResponse.json(
      { error: "Use a PDF, Word .doc, or .docx file." },
      { status: 400 },
    );
  }

  const replace = body.replace === true;
  const etag = typeof body.etag === "string" ? body.etag : null;
  if (replace && !etag) {
    return NextResponse.json(
      { error: "Confirm the existing document before replacing it." },
      { status: 400 },
    );
  }

  let current: { name: string; etag: string } | null;
  try {
    current = await findMinutesRecord(requested);
  } catch (error) {
    if (isMinutesConflict(error)) {
      return conflictResponse(error.storedName, error.etag);
    }
    return NextResponse.json(
      { error: "Could not check existing documents." },
      { status: 500 },
    );
  }

  const plan = minutesWritePlan(requested, current, replace, etag);
  if (plan.action === "conflict") return conflictResponse(plan.name, plan.etag);

  if (!minutesUsesBlob()) {
    return NextResponse.json(
      { error: "Direct upload is not available here.", fallback: true },
      { status: 503 },
    );
  }

  try {
    const upload = await createMinutesUploadUrl(
      plan.name,
      plan.action === "replace"
        ? { allowOverwrite: true, ifMatch: plan.etag }
        : { allowOverwrite: false },
    );
    return NextResponse.json(upload);
  } catch (error) {
    if (error instanceof MinutesConflictError || isMinutesConflict(error)) {
      return conflictResponse(error.storedName, error.etag);
    }
    return NextResponse.json(
      { error: "Could not start upload." },
      { status: 500 },
    );
  }
}
