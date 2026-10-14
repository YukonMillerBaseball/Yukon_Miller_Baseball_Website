import { requireMinutes } from "@/lib/minutes-auth";
import {
  MEDIA_CONFLICT_MESSAGE,
  MAX_COVER_BYTES,
  MediaCatalogConflict,
  addCollection,
  editCollection,
  emptyCatalog,
  inspectCover,
  isListedMediaSeason,
  parseCollectionInput,
  parseCoverFrame,
  parseVersion,
  removeCollection,
  reorderCollections,
  toMediaCards,
  type MediaCatalog,
} from "@/lib/media-catalog";
import { mediaRequestAllowed } from "@/lib/media-origin";
import {
  deleteMediaCover,
  readMediaCatalog,
  saveMediaCatalog,
  saveMediaCover,
} from "@/lib/media-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function catalogResponse(catalog: MediaCatalog, unavailable = false) {
  return NextResponse.json({
    version: catalog.version,
    items: toMediaCards(catalog),
    unavailable,
  });
}

function conflictResponse() {
  return NextResponse.json(
    { error: MEDIA_CONFLICT_MESSAGE, conflict: true },
    { status: 409 },
  );
}

function rejectWrite() {
  return NextResponse.json({ error: "Could not save the library." }, { status: 403 });
}

async function requireAdmin() {
  return requireMinutes({
    admin: true,
    touch: true,
    adminError: "Admin sign-in required.",
  });
}

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

async function readCover(form: FormData) {
  const file = form.get("cover");
  if (!(file instanceof File) || file.size === 0) return { cover: null } as const;
  if (file.size > MAX_COVER_BYTES) {
    return { error: "Use a JPEG, PNG, or WebP cover up to 2 MB." } as const;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = inspectCover(bytes);
  if (!image) {
    return { error: "Use a JPEG, PNG, or WebP cover up to 2 MB." } as const;
  }
  return { cover: { bytes, ...image } } as const;
}

export async function GET() {
  const { response } = await requireMinutes();
  if (response) return response;
  const read = await readMediaCatalog();
  if (read.status !== "ready") {
    return catalogResponse(emptyCatalog(), true);
  }
  return catalogResponse(read.catalog);
}

export async function POST(request: Request) {
  if (!mediaRequestAllowed(request)) return rejectWrite();
  const { response } = await requireAdmin();
  if (response) return response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }

  const expectedVersion = parseVersion(field(form, "version"));
  if (expectedVersion === null) {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }
  const parsed = parseCollectionInput({
    title: field(form, "title"),
    description: field(form, "description"),
    season: field(form, "season"),
    category: field(form, "category"),
    url: field(form, "url"),
    linkKind: field(form, "linkKind"),
  });
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  if (!isListedMediaSeason(parsed.input.season)) {
    return NextResponse.json({ error: "Choose a season." }, { status: 400 });
  }
  const coverFrame = parseCoverFrame({
    coverFit: field(form, "coverFit"),
    coverX: field(form, "coverX"),
    coverY: field(form, "coverY"),
  });
  if ("error" in coverFrame) {
    return NextResponse.json({ error: coverFrame.error }, { status: 400 });
  }
  const coverResult = await readCover(form);
  if ("error" in coverResult) {
    return NextResponse.json({ error: coverResult.error }, { status: 400 });
  }

  const read = await readMediaCatalog();
  if (read.status !== "ready") {
    return NextResponse.json(
      { error: "The media library is temporarily unavailable." },
      { status: 503 },
    );
  }

  let coverFile: string | null = null;
  try {
    if (coverResult.cover) {
      coverFile = await saveMediaCover(
        coverResult.cover.bytes,
        coverResult.cover.contentType,
        coverResult.cover.extension,
      );
    }
    const added = addCollection(
      read.catalog,
      expectedVersion,
      parsed.input,
      coverFile,
      coverFrame,
    );
    if ("error" in added) {
      await deleteMediaCover(coverFile);
      return NextResponse.json({ error: added.error }, { status: 400 });
    }
    await saveMediaCatalog(added.catalog, {
      version: read.catalog.version,
      etag: read.etag,
    });
    return catalogResponse(added.catalog);
  } catch (error) {
    await deleteMediaCover(coverFile);
    if (error instanceof MediaCatalogConflict) return conflictResponse();
    return NextResponse.json({ error: "Could not save the library." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!mediaRequestAllowed(request)) return rejectWrite();
  const { response } = await requireAdmin();
  if (response) return response;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return reorder(request);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }

  const expectedVersion = parseVersion(field(form, "version"));
  const id = field(form, "id");
  if (expectedVersion === null || !COLLECTION_ID.test(id)) {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }
  const parsed = parseCollectionInput({
    title: field(form, "title"),
    description: field(form, "description"),
    season: field(form, "season"),
    category: field(form, "category"),
    url: field(form, "url"),
    linkKind: field(form, "linkKind"),
  });
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const coverFrame = parseCoverFrame({
    coverFit: field(form, "coverFit"),
    coverX: field(form, "coverX"),
    coverY: field(form, "coverY"),
  });
  if ("error" in coverFrame) {
    return NextResponse.json({ error: coverFrame.error }, { status: 400 });
  }
  const coverResult = await readCover(form);
  if ("error" in coverResult) {
    return NextResponse.json({ error: coverResult.error }, { status: 400 });
  }
  const removeCover = field(form, "removeCover") === "true";

  const read = await readMediaCatalog();
  if (read.status !== "ready") {
    return NextResponse.json(
      { error: "The media library is temporarily unavailable." },
      { status: 503 },
    );
  }
  if (!isListedMediaSeason(parsed.input.season)) {
    return NextResponse.json({ error: "Choose a season." }, { status: 400 });
  }

  let coverFile: string | null | undefined;
  let uploaded: string | null = null;
  try {
    if (coverResult.cover) {
      uploaded = await saveMediaCover(
        coverResult.cover.bytes,
        coverResult.cover.contentType,
        coverResult.cover.extension,
      );
      coverFile = uploaded;
    } else if (removeCover) {
      coverFile = null;
    }
    const edited = editCollection(
      read.catalog,
      expectedVersion,
      id,
      parsed.input,
      coverFile,
      coverFrame,
    );
    if (edited === "missing") {
      await deleteMediaCover(uploaded);
      return NextResponse.json({ error: "That collection was not found." }, { status: 404 });
    }
    await saveMediaCatalog(edited.catalog, {
      version: read.catalog.version,
      etag: read.etag,
    });
    await deleteMediaCover(edited.retiredCover);
    return catalogResponse(edited.catalog);
  } catch (error) {
    await deleteMediaCover(uploaded);
    if (error instanceof MediaCatalogConflict) return conflictResponse();
    return NextResponse.json({ error: "Could not save the library." }, { status: 500 });
  }
}

async function reorder(request: Request) {
  let body: { version?: unknown; order?: unknown };
  try {
    body = (await request.json()) as { version?: unknown; order?: unknown };
  } catch {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }
  const expectedVersion = parseVersion(body.version);
  if (expectedVersion === null || !Array.isArray(body.order)) {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }
  if (!body.order.every((id) => typeof id === "string" && COLLECTION_ID.test(id))) {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }

  const read = await readMediaCatalog();
  if (read.status !== "ready") {
    return NextResponse.json(
      { error: "The media library is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const ordered = reorderCollections(read.catalog, expectedVersion, body.order);
    if (ordered === "invalid") {
      return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
    }
    await saveMediaCatalog(ordered.catalog, {
      version: read.catalog.version,
      etag: read.etag,
    });
    return catalogResponse(ordered.catalog);
  } catch (error) {
    if (error instanceof MediaCatalogConflict) return conflictResponse();
    return NextResponse.json({ error: "Could not save the library." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!mediaRequestAllowed(request)) return rejectWrite();
  const { response } = await requireAdmin();
  if (response) return response;

  let body: { version?: unknown; id?: unknown };
  try {
    body = (await request.json()) as { version?: unknown; id?: unknown };
  } catch {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }
  const expectedVersion = parseVersion(body.version);
  if (expectedVersion === null || typeof body.id !== "string") {
    return NextResponse.json({ error: "Could not save the library." }, { status: 400 });
  }

  const read = await readMediaCatalog();
  if (read.status !== "ready") {
    return NextResponse.json(
      { error: "The media library is temporarily unavailable." },
      { status: 503 },
    );
  }

  try {
    const removed = removeCollection(read.catalog, expectedVersion, body.id);
    if (removed === "missing") {
      return NextResponse.json({ error: "That collection was not found." }, { status: 404 });
    }
    await saveMediaCatalog(removed.catalog, {
      version: read.catalog.version,
      etag: read.etag,
    });
    await deleteMediaCover(removed.retiredCover);
    return catalogResponse(removed.catalog);
  } catch (error) {
    if (error instanceof MediaCatalogConflict) return conflictResponse();
    return NextResponse.json({ error: "Could not save the library." }, { status: 500 });
  }
}
