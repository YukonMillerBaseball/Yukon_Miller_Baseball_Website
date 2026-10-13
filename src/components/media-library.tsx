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
  MEDIA_CONFLICT_MESSAGE,
  compareSeasons,
  mediaLinkLabel,
  parseMediaUrl,
  type MediaCard,
} from "@/lib/media-catalog";
import { publishMinutesLock } from "@/lib/minutes-session";
import { CoverOptimizeError, optimizeCoverImage } from "@/lib/optimize-cover";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";

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
        <p className="font-heading text-3xl tracking-wide text-white/80 uppercase">
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
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase">
        {label}
      </span>
      {["all", ...options].map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full border px-3 py-1 text-[0.68rem] tracking-[0.14em] uppercase",
              selected
                ? "border-[#c8102e] bg-[#c8102e] text-white"
                : "border-white/15 text-zinc-400 hover:text-white",
            )}
          >
            {option === "all" ? "All" : option}
          </button>
        );
      })}
    </div>
  );
}

function CollectionFields({
  initial,
  seasons,
  categories,
}: {
  initial?: MediaCard | null;
  seasons: string[];
  categories: string[];
}) {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
            Year or season
          </span>
          <input
            name="season"
            required
            maxLength={40}
            list="media-seasons"
            defaultValue={initial?.season ?? ""}
            className={fieldClass}
          />
          <datalist id="media-seasons">
            {seasons.map((season) => (
              <option key={season} value={season} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
            Category
          </span>
          <input
            name="category"
            required
            maxLength={40}
            list="media-categories"
            defaultValue={initial?.category ?? ""}
            className={fieldClass}
          />
          <datalist id="media-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
      </div>
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
  const [season, setSeason] = useState("all");
  const [category, setCategory] = useState("all");
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
    () => [...new Set(ordered.map((item) => item.season))].sort(compareSeasons),
    [ordered],
  );
  const categories = useMemo(
    () => [...new Set(ordered.map((item) => item.category))].sort((a, b) => a.localeCompare(b)),
    [ordered],
  );
  const seasonFilter = season !== "all" && !seasons.includes(season) ? "all" : season;
  const categoryFilter =
    category !== "all" && !categories.includes(category) ? "all" : category;
  const visible = ordered.filter((item) => {
    if (seasonFilter !== "all" && item.season !== seasonFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    return true;
  });
  const filtering = seasonFilter !== "all" || categoryFilter !== "all";

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
        <div className="mt-6 space-y-3">
          <FilterRow
            label="Season"
            value={seasonFilter}
            options={seasons}
            onChange={setSeason}
          />
          <FilterRow
            label="Category"
            value={categoryFilter}
            options={categories}
            onChange={setCategory}
          />
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
        <p className="mt-8 text-sm text-zinc-400">No collections match these filters.</p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const href = safeHref(item.url);
          const index = ordered.findIndex((entry) => entry.id === item.id);
          return (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
            >
              <div className="aspect-[16/10]">
                <Cover season={item.season} url={item.coverUrl} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-red-400 uppercase">
                  {item.category}
                </p>
                <h2 className="font-heading mt-2 text-2xl tracking-wide text-white uppercase">
                  {item.title}
                </h2>
                <p className="mt-1 text-[0.68rem] tracking-[0.14em] text-zinc-500 uppercase">
                  {item.season}
                </p>
                {item.description ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{item.description}</p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants(), "h-9 px-3 text-xs uppercase")}
                    >
                      {mediaLinkLabel(item.linkKind)}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {canAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setEditing(item);
                        }}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-9 border-white/15 px-3 text-xs uppercase",
                        )}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setDeleteId(item.id);
                        }}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-9 border-white/15 px-3 text-xs uppercase",
                        )}
                      >
                        Delete
                      </button>
                      {!filtering ? (
                        <>
                          <button
                            type="button"
                            disabled={pending || index === 0}
                            onClick={() => move(item.id, -1)}
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "h-9 border-white/15 px-3 text-xs uppercase",
                            )}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            disabled={pending || index === ordered.length - 1}
                            onClick={() => move(item.id, 1)}
                            className={cn(
                              buttonVariants({ variant: "outline" }),
                              "h-9 border-white/15 px-3 text-xs uppercase",
                            )}
                          >
                            Down
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
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
            <CollectionFields
              initial={editing}
              seasons={seasons}
              categories={categories}
            />
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
