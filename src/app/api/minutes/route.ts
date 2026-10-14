import { privateJson, requireMinutes } from "@/lib/minutes-auth";
import {
  findMinutesRecord,
  isAllowedDocument,
  isMinutesConflict,
  listMinutesLibrary,
  MAX_MINUTES_BYTES,
  MinutesConflictError,
  minutesWritePlan,
  safeMinutesName,
  saveMinutes,
} from "@/lib/minutes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { response } = await requireMinutes();
  if (response) return response;

  try {
    const library = await listMinutesLibrary();
    return privateJson({
      files: library.files,
      unavailable: library.unavailable,
    });
  } catch {
    return privateJson({ files: [], unavailable: true });
  }
}

export async function POST(request: Request) {
  const { response } = await requireMinutes({
    admin: true,
    touch: true,
    adminError: "Admin sign-in required to upload.",
  });
  if (response) return response;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return privateJson({ error: "Choose a document." }, { status: 400 });
  }
  if (file.size > MAX_MINUTES_BYTES) {
    return privateJson(
      { error: "File must be 80 MB or smaller." },
      { status: 400 },
    );
  }

  const name = safeMinutesName(file.name);
  if (!name) {
    return privateJson(
      { error: "Use a PDF, Word .doc, or .docx file." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(await isAllowedDocument(name, bytes))) {
    return privateJson(
      { error: "Use a PDF, Word .doc, or .docx file." },
      { status: 400 },
    );
  }

  const replace = form.get("replace") === "1";
  const etagValue = form.get("etag");
  const etag = typeof etagValue === "string" ? etagValue : null;
  if (replace && !etag) {
    return privateJson(
      { error: "Confirm the existing document before replacing it." },
      { status: 400 },
    );
  }

  let current: { name: string; etag: string } | null;
  try {
    current = await findMinutesRecord(name);
  } catch {
    return privateJson(
      { error: "Could not check existing documents." },
      { status: 500 },
    );
  }
  const plan = minutesWritePlan(name, current, replace, etag);
  if (plan.action === "conflict") {
    return privateJson(
      {
        exists: true,
        name: plan.name,
        etag: plan.etag,
        error:
          "A document with this filename is already stored in Meeting Minutes.",
      },
      { status: 409 },
    );
  }

  try {
    await saveMinutes(
      plan.name,
      bytes,
      plan.action === "replace"
        ? { replace: true, etag: plan.etag }
        : { replace: false },
    );
  } catch (error) {
    if (error instanceof MinutesConflictError || isMinutesConflict(error)) {
      return privateJson(
        {
          exists: true,
          name: error.storedName,
          etag: error.etag,
          error: error.message,
        },
        { status: 409 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Could not save that file.";
    return privateJson({ error: message }, { status: 500 });
  }

  try {
    const library = await listMinutesLibrary();
    return privateJson({
      ok: true,
      files: library.files,
      unavailable: library.unavailable,
    });
  } catch {
    return privateJson({ ok: true, files: [], unavailable: true });
  }
}
