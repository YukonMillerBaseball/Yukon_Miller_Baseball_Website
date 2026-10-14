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
  COVER_ZOOM_MAX,
  COVER_ZOOM_MIN,
  MEDIA_SEASONS,
  MEDIA_CONFLICT_MESSAGE,
  browseSeasons,
  coverFrameLayout,
  defaultBrowseSeason,
  mediaLinkLabel,
  parseMediaUrl,
  selectedMediaSeason,
  sortMediaCards,
  type CoverFit,
  type MediaCard,
  type MediaSort,
} from "@/lib/media-catalog";
import { publishMinutesLock } from "@/lib/minutes-session";
import { CoverOptimizeError, optimizeCoverImage } from "@/lib/optimize-cover";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

type LibraryPayload = {
  version?: number;
  items?: MediaCard[];
  unavailable?: boolean;
  error?: string;
  conflict?: boolean;
  expired?: boolean;
};

// 16px on phones so iOS Safari does not zoom the page when a field is focused.
const fieldClass =
  "mt-2 h-11 w-full min-w-0 max-w-full rounded-lg border border-white/15 bg-black px-3 text-base text-white outline-none focus:border-red-500 sm:text-sm";

function safeHref(url: string) {
  const parsed = parseMediaUrl(url);
  return parsed;
}

function coverFrameStyle(fit: CoverFit, x: number, y: number): CSSProperties {
  return {
    objectFit: fit,
    objectPosition: `${x}% ${y}%`,
  };
}

function FramedPhoto({
  src,
  fit,
  x,
  y,
  zoom,
  lazy,
  onError,
}: {
  src: string;
  fit: CoverFit;
  x: number;
  y: number;
  zoom: number;
  lazy?: boolean;
  onError?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const zoomed = fit === "cover" && zoom !== 100;
  const layout =
    zoomed && natural && box.width > 0 && box.height > 0
      ? coverFrameLayout(box, natural, { fit, x, y, zoom })
      : null;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !zoomed) return;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setBox((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [zoomed]);

  return (
    <div ref={frameRef} className="absolute inset-0">
      {/* Authenticated covers and local previews are not next/image sources. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          "pointer-events-none select-none",
          layout ? "absolute max-w-none" : "size-full min-w-0",
        )}
        style={
          layout
            ? { width: layout.width, height: layout.height, left: layout.left, top: layout.top }
            : { ...coverFrameStyle(fit, x, y), visibility: zoomed ? "hidden" : "visible" }
        }
        loading={lazy ? "lazy" : undefined}
        decoding="async"
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0) {
            setNatural({ width: image.naturalWidth, height: image.naturalHeight });
          }
        }}
        onError={onError}
      />
    </div>
  );
}

function Cover({
  season,
  url,
  fit,
  x,
  y,
  zoom,
}: {
  season: string;
  url: string | null;
  fit: CoverFit;
  x: number;
  y: number;
  zoom: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="absolute inset-0 flex items-end bg-zinc-900 p-4">
        <p className="font-heading text-lg tracking-wide text-white/80 uppercase">
          {season}
        </p>
      </div>
    );
  }
  return (
    <FramedPhoto
      src={url}
      fit={fit}
      x={x}
      y={y}
      zoom={zoom}
      lazy
      onError={() => setFailed(true)}
    />
  );
}

const controlClass =
  "h-11 w-full min-w-0 max-w-full rounded-lg border border-white/15 bg-black px-3 text-base text-white outline-none focus:border-[#c8102e] sm:h-10 sm:text-sm";

const labelClass = "shrink-0 text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase";

const MENU_WIDTH = 208;
const MENU_GAP = 8;

function placeCollectionMenu(rect: DOMRect, menuHeight: number) {
  const width = Math.min(MENU_WIDTH, Math.max(0, window.innerWidth - MENU_GAP * 2));
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
  const spaceAbove = rect.top - MENU_GAP;
  const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const maxHeight = Math.max(96, Math.floor(openUp ? spaceAbove : spaceBelow));
  const height = Math.min(menuHeight, maxHeight);
  let top = openUp ? rect.top - MENU_GAP - height : rect.bottom + MENU_GAP;
  top = Math.max(MENU_GAP, Math.min(top, window.innerHeight - MENU_GAP - height));
  let left = rect.right - width;
  const maxLeft = Math.max(MENU_GAP, window.innerWidth - MENU_GAP - width);
  left = Math.max(MENU_GAP, Math.min(left, maxLeft));
  return { top, left, width, maxHeight };
}

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [box, setBox] = useState<ReturnType<typeof placeCollectionMenu> | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    if (!button) return;

    function place() {
      const current = buttonRef.current;
      const menu = menuRef.current;
      if (!current || !menu) return;
      const next = placeCollectionMenu(current.getBoundingClientRect(), menu.scrollHeight);
      setBox((previous) =>
        previous &&
        previous.top === next.top &&
        previous.left === next.left &&
        previous.width === next.width &&
        previous.maxHeight === next.maxHeight
          ? previous
          : next,
      );
    }

    place();
    const observer = new ResizeObserver(place);
    if (menuRef.current) observer.observe(menuRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onCloseRef.current();
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

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Collection actions"
            data-collection-menu
            className="fixed z-50 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-zinc-950 py-1 shadow-xl"
            style={
              box
                ? { top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }
                : { top: 0, left: MENU_GAP, width: MENU_WIDTH, visibility: "hidden" }
            }
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="absolute top-2 right-2 z-20">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Collection actions"
        onClick={onToggle}
        className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white outline-none hover:border-white/30 focus-visible:ring-2 focus-visible:ring-[#c8102e] sm:size-9"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clampZoom(value: number) {
  return Math.min(COVER_ZOOM_MAX, Math.max(COVER_ZOOM_MIN, Math.round(value)));
}

function frameButtonClass(active = false) {
  return cn(
    "h-9 rounded-lg border px-3 text-xs tracking-[0.14em] uppercase",
    active
      ? "border-[#c8102e] bg-[#c8102e] text-white"
      : "border-white/15 bg-black text-zinc-200 hover:border-white/30",
  );
}

function CollectionFields({ initial }: { initial?: MediaCard | null }) {
  const season = selectedMediaSeason(initial?.season);
  const [fit, setFit] = useState<CoverFit>(initial?.coverFit ?? "cover");
  const [x, setX] = useState(initial?.coverX ?? 50);
  const [y, setY] = useState(initial?.coverY ?? 50);
  const [zoom, setZoom] = useState(initial?.coverZoom ?? 100);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const objectUrl = useRef<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const shownUrl = previewUrl ?? (removeCover ? null : (initial?.coverUrl ?? null));

  useEffect(() => {
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!shownUrl) return;
    previewRef.current?.scrollIntoView({ block: "nearest" });
  }, [shownUrl]);

  function onCoverFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPreviewFailed(false);
    if (!file || file.size === 0) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setPreviewUrl(url);
    setRemoveCover(false);
    setFit("cover");
    setX(50);
    setY(50);
    setZoom(100);
  }

  function onFramePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x,
      originY: y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onFramePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    setX(clampPercent(current.originX - (dx / Math.max(rect.width, 1)) * 100));
    setY(clampPercent(current.originY - (dy / Math.max(rect.height, 1)) * 100));
  }

  function onFramePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

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
          onChange={onCoverFile}
          className="mt-2 block w-full min-w-0 max-w-full text-base text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:tracking-[0.14em] file:text-white file:uppercase sm:text-sm"
        />
        <span className="mt-2 block text-xs leading-5 text-zinc-500">
          Large photos are resized before upload. The original stays on your device.
        </span>
      </label>
      <input type="hidden" name="coverFit" value={fit} />
      <input type="hidden" name="coverX" value={x} />
      <input type="hidden" name="coverY" value={y} />
      <input type="hidden" name="coverZoom" value={zoom} />
      {shownUrl ? (
        <div>
          <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
            Card preview
          </p>
          <div
            ref={previewRef}
            role="application"
            tabIndex={0}
            aria-label="Cover position. Drag the photo or use the arrow keys to move it."
            className="relative mt-2 aspect-video cursor-grab touch-none overflow-hidden rounded-xl bg-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-[#c8102e] active:cursor-grabbing"
            onPointerDown={onFramePointerDown}
            onPointerMove={onFramePointerMove}
            onPointerUp={onFramePointerEnd}
            onPointerCancel={onFramePointerEnd}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 10 : 5;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setX((value) => clampPercent(value + step));
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setX((value) => clampPercent(value - step));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setY((value) => clampPercent(value + step));
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setY((value) => clampPercent(value - step));
              }
            }}
          >
            {previewFailed ? (
              <div className="flex h-full items-end p-3">
                <p className="text-xs leading-5 text-zinc-400">
                  This photo cannot be previewed here. It will use the frame you choose after it is saved.
                </p>
              </div>
            ) : (
              <FramedPhoto
                src={shownUrl}
                fit={fit}
                x={x}
                y={y}
                zoom={zoom}
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Drag the photo to choose what the card shows. With Fill selected, zoom out to show more of the photo or zoom in to crop closer. Center puts it in the middle. Fit shows the whole photo.
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Cover framing">
            <button type="button" className={frameButtonClass()} onClick={() => { setX(50); setY(50); }}>
              Center
            </button>
            <button
              type="button"
              className={frameButtonClass(fit === "cover")}
              aria-pressed={fit === "cover"}
              onClick={() => setFit("cover")}
            >
              Fill
            </button>
            <button
              type="button"
              className={frameButtonClass(fit === "contain")}
              aria-pressed={fit === "contain"}
              onClick={() => setFit("contain")}
            >
              Fit
            </button>
          </div>
          {fit === "cover" ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
                  Zoom
                </span>
                <span className="text-xs text-zinc-400">{zoom}%</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Zoom out"
                  className={frameButtonClass()}
                  onClick={() => setZoom((value) => clampZoom(value - 10))}
                >
                  −
                </button>
                <input
                  type="range"
                  min={COVER_ZOOM_MIN}
                  max={COVER_ZOOM_MAX}
                  step={5}
                  value={zoom}
                  aria-label="Cover zoom"
                  onChange={(event) => setZoom(clampZoom(Number(event.target.value)))}
                  className="h-11 min-w-0 flex-1 accent-[#c8102e]"
                />
                <button
                  type="button"
                  aria-label="Zoom in"
                  className={frameButtonClass()}
                  onClick={() => setZoom((value) => clampZoom(value + 10))}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs leading-5 text-zinc-500">
          After you choose a photo, drag it in the preview to center it or fit it to the card.
        </p>
      )}
      {initial?.coverUrl ? (
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            name="removeCover"
            type="checkbox"
            value="true"
            checked={removeCover}
            onChange={(event) => setRemoveCover(event.target.checked)}
          />
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
    <div className="min-w-0 max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 break-words text-zinc-400 sm:min-w-0">
          These links open in a new tab. Google Photos and other hosts keep their
          own sharing settings.
        </p>
        <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
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
            Log out
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
        <div className="mt-3 grid min-w-0 gap-2 sm:mt-6 sm:gap-3">
          <div className="grid min-w-0 gap-1.5 sm:max-w-md">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search collections..."
              aria-label="Search collections"
              className={cn(controlClass, "appearance-none")}
            />
            <p className={labelClass} aria-live="polite">
              {visible.length} {visible.length === 1 ? "collection" : "collections"}
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:max-w-xl">
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

      <div className="mt-3 grid w-full min-w-0 grid-cols-2 gap-2.5 sm:mt-6 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {visible.map((item) => {
          const href = safeHref(item.url);
          const index = ordered.findIndex((entry) => entry.id === item.id);
          const action = mediaLinkLabel(item.linkKind);
          const body = (
            <>
              <div className="relative aspect-video overflow-hidden rounded-t-xl bg-zinc-900">
                <Cover
                  season={item.season}
                  url={item.coverUrl}
                  fit={item.coverFit}
                  x={item.coverX}
                  y={item.coverY}
                  zoom={item.coverZoom}
                />
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
