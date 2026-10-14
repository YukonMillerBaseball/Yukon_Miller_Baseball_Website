"use client";

import { useEndMinutesSession } from "@/components/minutes-session-guard";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MEDIA_SEASONS,
  MEDIA_CONFLICT_MESSAGE,
  browseSeasons,
  defaultBrowseSeason,
  mediaLinkLabel,
  parseMediaUrl,
  selectedMediaSeason,
  sortMediaCards,
  type MediaCard,
  type MediaSort,
} from "@/lib/media-catalog";
import { publishMinutesLock } from "@/lib/minutes-session";
import { CoverOptimizeError, optimizeCoverImage } from "@/lib/optimize-cover";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type LibraryPayload = {
  version?: number;
  items?: MediaCard[];
  unavailable?: boolean;
  error?: string;
  conflict?: boolean;
  expired?: boolean;
};

const fieldClass =
  "mt-2 h-11 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-white outline-none focus:border-red-500";

function safeHref(url: string) {
  const parsed = parseMediaUrl(url);
  return parsed;
}

function Cover({ season, url }: { season: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="flex h-full items-end bg-zinc-900 p-4">
        <p className="font-heading text-lg tracking-wide text-white/80 uppercase">
          {season}
        </p>
      </div>
    );
  }
  return (
    // Authenticated cover routes cannot be optimized by next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="size-full object-cover object-center"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

const controlClass =
  "h-10 min-w-0 rounded-lg border border-white/15 bg-black px-3 text-sm text-white outline-none focus:border-[#c8102e]";

const labelClass = "shrink-0 text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase";

function CollectionMenu({
  open,
  pending,
  canReorder,
  reorderHint,
  canMoveUp,
  canMoveDown,
  onToggle,
  onClose,
  onEdit,
  onDelete,
  onMove,
}: {
  open: boolean;
  pending: boolean;
  canReorder: boolean;
  reorderHint: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [placement, setPlacement] = useState<"down" | "up">("down");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setPlacement(spaceBelow < 240 && rect.top > spaceBelow ? "up" : "down");
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onCloseRef.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "flex min-h-11 w-full items-center px-3 text-left text-sm text-white hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-transparent";

  return (
    <div ref={rootRef} className="absolute top-2 right-2 z-20">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Collection actions"
        onClick={onToggle}
        className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white outline-none hover:border-white/30 focus-visible:ring-2 focus-visible:ring-[#c8102e] sm:size-9"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Collection actions"
          className={cn(
            "absolute right-0 z-30 max-h-[70vh] w-52 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 py-1 shadow-xl",
            placement === "up" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          <button type="button" role="menuitem" className={itemClass} onClick={onEdit}>
            Edit collection
          </button>
          {reorderHint ? (
            <p className="px-3 py-2 text-[0.65rem] leading-4 tracking-[0.08em] text-zinc-500 uppercase">
              {reorderHint}
            </p>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={pending || !canReorder || !canMoveUp}
            onClick={() => onMove(-1)}
          >
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            disabled={pending || !canReorder || !canMoveDown}
            onClick={() => onMove(1)}
          >
            Move down
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(itemClass, "text-red-400 disabled:text-zinc-600")}
            onClick={onDelete}
          >
            Delete collection
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CollectionFields({ initial }: { initial?: MediaCard | null }) {
  const season = selectedMediaSeason(initial?.season);
  return (
    <div className="grid gap-4">
      <label className="block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Title
        </span>
        <input
          name="title"
          required
          maxLength={120}
          defaultValue={initial?.title ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Description
        </span>
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={initial?.description ?? ""}
          className={cn(fieldClass, "h-auto py-2")}
        />
      </label>
      <label className="block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Year
        </span>
        <select name="season" required defaultValue={season} className={fieldClass}>
          {MEDIA_SEASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Link
        </span>
        <input
          name="url"
          type="url"
          required
          inputMode="url"
          placeholder="https://"
          maxLength={2000}
          defaultValue={initial?.url ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Link type
        </span>
        <select
          name="linkKind"
          defaultValue={initial?.linkKind ?? "photos"}
          className={fieldClass}
        >
          <option value="photos">Photos</option>
          <option value="video">Video</option>
          <option value="collection">Collection</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Cover image
        </span>
        <input
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
          className="mt-2 block w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:tracking-[0.14em] file:text-white file:uppercase"
        />
        <span className="mt-2 block text-xs leading-5 text-zinc-500">
          Large photos are resized before upload. The original stays on your device.
        </span>
      </label>
      {initial?.coverUrl ? (
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input name="removeCover" type="checkbox" value="true" />
          Remove current cover
        </label>
      ) : null}
    </div>
  );
}

export function MediaLibrary({
  version: initialVersion,
  items: initialItems,
  canAdmin,
  unavailable,
}: {
  version: number;
  items: MediaCard[];
  canAdmin: boolean;
  unavailable: boolean;
}) {
  const router = useRouter();
  const endSession = useEndMinutesSession();
  const [version, setVersion] = useState(initialVersion);
  const [items, setItems] = useState(initialItems);
  const [season, setSeason] = useState(() => defaultBrowseSeason(initialItems.map((item) => item.season)));
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MediaSort>("newest");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaCard | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savePhase, setSavePhase] = useState<"preparing" | "saving" | null>(null);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [libraryUnavailable, setLibraryUnavailable] = useState(unavailable);

  const ordered = useMemo(
    () => [...items].sort((left, right) => left.order - right.order),
    [items],
  );
  const seasons = useMemo(
    () => browseSeasons(ordered.map((item) => item.season)),
    [ordered],
  );
  const seasonFilter =
    season !== "all" && !seasons.includes(season) ? defaultBrowseSeason(seasons) : season;
  const query = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const matched = ordered.filter((item) => {
      if (seasonFilter !== "all" && item.season !== seasonFilter) return false;
      if (!query) return true;
      return `${item.title}\n${item.description}`.toLowerCase().includes(query);
    });
    return sortMediaCards(matched, sort);
  }, [ordered, query, seasonFilter, sort]);
  const canReorder = sort === "custom" && seasonFilter === "all" && query.length === 0;
  const reorderHint = canReorder
    ? ""
    : sort !== "custom"
      ? "Switch to custom order to rearrange."
      : "Clear the season and search to rearrange.";

  function applyPayload(data: LibraryPayload, response: Response) {
    if (response.status === 401) {
      void endSession("idle");
      return false;
    }
    if (data.conflict || response.status === 409) {
      setConflict(true);
      setError(data.error || MEDIA_CONFLICT_MESSAGE);
      return false;
    }
    if (!response.ok) {
      setError(data.error || "Could not save the library.");
      return false;
    }
    if (typeof data.version === "number" && Array.isArray(data.items)) {
      setVersion(data.version);
      setItems(data.items);
      setLibraryUnavailable(Boolean(data.unavailable));
      setError("");
      setConflict(false);
      return true;
    }
    setError("Could not save the library.");
    return false;
  }

  async function readPayload(response: Response) {
    const data = (await response.json().catch(() => ({}))) as LibraryPayload;
    return applyPayload(data, response);
  }

  async function submitCollection(form: HTMLFormElement, editingId: string | null) {
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setError("");
    try {
      const body = new FormData(form);
      const cover = body.get("cover");
      if (cover instanceof File && cover.size > 0) {
        setSavePhase("preparing");
        try {
          const optimized = await optimizeCoverImage(cover);
          body.set("cover", optimized);
        } catch (caught) {
          setError(
            caught instanceof CoverOptimizeError
              ? caught.message
              : "This photo could not be prepared for upload.",
          );
          return;
        }
      }
      setSavePhase("saving");
      body.set("version", String(version));
      if (editingId) body.set("id", editingId);
      const response = await fetch("/api/media", {
        method: editingId ? "PATCH" : "POST",
        body,
      });
      if (await readPayload(response)) {
        if (editingId) setEditing(null);
        else setAdding(false);
      }
    } catch {
      setError("Could not save the library.");
    } finally {
      savingRef.current = false;
      setPending(false);
      setSavePhase(null);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCollection(event.currentTarget, null);
  }

  async function onEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    await submitCollection(event.currentTarget, editing.id);
  }

  async function onDelete() {
    if (!deleteId) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, id: deleteId }),
      });
      if (await readPayload(response)) setDeleteId(null);
    } catch {
      setError("Could not save the library.");
    } finally {
      setPending(false);
    }
  }

  async function onReorder(ids: string[]) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, order: ids }),
      });
      await readPayload(response);
    } catch {
      setError("Could not save the library.");
    } finally {
      setPending(false);
    }
  }

  function move(id: string, direction: -1 | 1) {
    const ids = ordered.map((item) => item.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = ids.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    void onReorder(next);
  }

  async function onLock() {
    publishMinutesLock();
    await fetch("/api/minutes/auth", { method: "DELETE" });
    router.refresh();
  }

  const formOpen = adding || editing !== null;
  const deleting = ordered.find((item) => item.id === deleteId);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          These links open in a new tab. Google Photos and other hosts keep their
          own sharing settings.
        </p>
        <div className="flex flex-wrap gap-2">
          {canAdmin && !libraryUnavailable ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setAdding(true);
              }}
              className={cn(buttonVariants(), "h-10 px-4 uppercase")}
            >
              Add collection
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onLock()}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 border-white/15 px-4 uppercase",
            )}
          >
            Lock
          </button>
        </div>
      </div>

      {libraryUnavailable ? (
        <p className="mt-6 text-sm text-zinc-300" role="status">
          The media library is temporarily unavailable. Try again in a few minutes.
        </p>
      ) : null}

      {error ? (
        <p className={cn("mt-4 text-sm", conflict ? "text-amber-200" : "text-red-400")} role="status">
          {error}{" "}
          {conflict ? (
            <button
              type="button"
              className="underline"
              onClick={() => router.refresh()}
            >
              Reload
            </button>
          ) : null}
        </p>
      ) : null}

      {!libraryUnavailable && ordered.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:mt-6 sm:gap-3">
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search collections..."
              aria-label="Search collections"
              className={cn(controlClass, "w-full sm:max-w-md")}
            />
            <p className={cn(labelClass, "text-right")} aria-live="polite">
              {visible.length} {visible.length === 1 ? "collection" : "collections"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
            <label className="grid min-w-0 gap-1">
              <span className={labelClass}>Season</span>
              <select
                value={seasonFilter}
                onChange={(event) => setSeason(event.target.value)}
                aria-label="Season"
                className={cn(controlClass, "w-full")}
              >
                <option value="all">All seasons</option>
                {seasons.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1">
              <span className={labelClass}>Sort by</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as MediaSort)}
                aria-label="Sort by"
                className={cn(controlClass, "w-full")}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title-asc">Title A-Z</option>
                <option value="title-desc">Title Z-A</option>
                <option value="custom">Custom order</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {!libraryUnavailable && ordered.length === 0 ? (
        <EmptyState
          kicker="Media library"
          title="No collections yet"
          body="Collections added by an administrator will appear here."
          className="mt-8"
        />
      ) : null}

      {!libraryUnavailable && ordered.length > 0 && visible.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-400">
          {query ? "No collections match your search." : "No collections match these filters."}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {visible.map((item) => {
          const href = safeHref(item.url);
          const index = ordered.findIndex((entry) => entry.id === item.id);
          const action = mediaLinkLabel(item.linkKind);
          const body = (
            <>
              <div className="aspect-video overflow-hidden rounded-t-xl bg-zinc-900">
                <Cover season={item.season} url={item.coverUrl} />
              </div>
              <div className="px-2.5 py-2">
                <h2 className="font-heading line-clamp-2 text-[0.8rem] leading-4 tracking-wide text-white uppercase">
                  {item.title}
                </h2>
                <p className="mt-1 text-[0.6rem] leading-4 tracking-[0.12em] text-zinc-500 uppercase">
                  {item.season}
                </p>
                <span className="mt-1 block text-[0.62rem] leading-4 font-semibold tracking-[0.12em] text-[#c8102e] uppercase">
                  {action}
                  {href ? <span className="sr-only"> (opens in a new tab)</span> : null}
                </span>
              </div>
            </>
          );
          return (
            <article
              key={item.id}
              className="relative min-w-0 rounded-xl border border-white/10 bg-zinc-950"
            >
              {canAdmin ? (
                <CollectionMenu
                  open={openMenuId === item.id}
                  pending={pending}
                  canReorder={canReorder}
                  reorderHint={reorderHint}
                  canMoveUp={index > 0}
                  canMoveDown={index >= 0 && index < ordered.length - 1}
                  onToggle={() => setOpenMenuId((current) => (current === item.id ? null : item.id))}
                  onClose={() => setOpenMenuId((current) => (current === item.id ? null : current))}
                  onEdit={() => {
                    setOpenMenuId(null);
                    setError("");
                    setEditing(item);
                  }}
                  onDelete={() => {
                    setOpenMenuId(null);
                    setError("");
                    setDeleteId(item.id);
                  }}
                  onMove={(direction) => {
                    setOpenMenuId(null);
                    move(item.id, direction);
                  }}
                />
              ) : null}
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-[#c8102e] focus-visible:ring-inset"
                >
                  {body}
                </a>
              ) : (
                <div className="min-w-0">{body}</div>
              )}
            </article>
          );
        })}
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setAdding(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-zinc-950 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              {editing ? "Edit collection" : "Add collection"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Paste a shared album or video link. The file stays on the host site.
            </DialogDescription>
          </DialogHeader>
          <form
            key={editing?.id ?? "new"}
            onSubmit={editing ? onEdit : onCreate}
            aria-busy={pending}
            className="grid gap-4"
          >
            <CollectionFields initial={editing} />
            {error && formOpen ? (
              <p className={cn("text-sm", conflict ? "text-amber-200" : "text-red-400")}>
                {error}{" "}
                {conflict ? (
                  <button type="button" className="underline" onClick={() => router.refresh()}>
                    Reload
                  </button>
                ) : null}
              </p>
            ) : null}
            {savePhase ? (
              <p role="status" className="text-sm text-zinc-300">
                {savePhase === "preparing" ? "Preparing photo…" : "Saving collection…"}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className={cn(buttonVariants(), "h-10 px-4 uppercase")}
            >
              {savePhase === "preparing"
                ? "Preparing photo…"
                : pending
                  ? "Saving…"
                  : "Save collection"}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteId(null);
        }}
      >
        <DialogContent className="bg-zinc-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">Delete collection</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {deleting
                ? `Remove “${deleting.title}” from the library. The external album stays where it is.`
                : "Remove this collection from the library."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeleteId(null)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 border-white/15 px-4 uppercase",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void onDelete()}
              className={cn(buttonVariants(), "h-10 px-4 uppercase")}
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
