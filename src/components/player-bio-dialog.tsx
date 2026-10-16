"use client";

import { PhotoSlot } from "@/components/photo-slot";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adjacentPlayer,
  bioValue,
  displayName,
  fullName,
  players,
  type Player,
} from "@/lib/roster";
import { ChevronDown, ChevronUp, XIcon } from "lucide-react";

type PlayerBioDialogProps = {
  player: Player | null;
  onClose: () => void;
  onSelect: (player: Player) => void;
  list?: Player[];
};

function BioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/8 bg-black/40 px-3 py-3">
      <p className="text-[0.62rem] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="font-heading mt-1.5 text-2xl leading-none tracking-wide text-white uppercase">
        {value}
      </p>
    </div>
  );
}

export function PlayerBioDialog({
  player,
  onClose,
  onSelect,
  list = players,
}: PlayerBioDialogProps) {
  const previous = player ? adjacentPlayer(player.id, -1, list) : undefined;
  const next = player ? adjacentPlayer(player.id, 1, list) : undefined;
  const slot = player
    ? list.findIndex((entry) => entry.id === player.id) + 1
    : 0;

  return (
    <Dialog open={player !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/80 supports-backdrop-filter:backdrop-blur-sm"
        className="max-h-[calc(100vh-2rem)] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto border border-white/12 bg-[#0a0a0c] p-0 text-white ring-0 sm:max-w-xl"
        onKeyDown={(event) => {
          if (!player) return;
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            if (previous) onSelect(previous);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            if (next) onSelect(next);
          }
        }}
      >
        {player ? (
          <>
            <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#1a0a0d_0%,#0a0a0c_100%)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(200,16,46,0.28),transparent_48%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c8102e] to-transparent" />
              <DialogClose
                className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white transition-colors hover:border-white/35 hover:bg-black/80"
                aria-label="Close player bio"
              >
                <XIcon className="size-4" />
              </DialogClose>
              <div className="relative grid gap-5 px-5 py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:px-6 sm:pt-7 sm:pb-6">
                <PhotoSlot
                  label="Player photo"
                  src={player.photo}
                  alt={fullName(player)}
                  sizes="(max-width: 639px) calc(100vw - 4rem), 11rem"
                  className="aspect-[3/4] w-full shrink-0 self-start justify-self-start rounded-xl ring-1 ring-white/10"
                />
                <div className="min-w-0 pr-8">
                  <p className="text-[0.68rem] font-semibold tracking-[0.32em] text-red-400 uppercase">
                    Player bio
                  </p>
                  <DialogTitle className="font-heading mt-2 text-4xl leading-none tracking-wide text-white uppercase sm:text-5xl">
                    {fullName(player)}
                  </DialogTitle>
                  <DialogDescription className="mt-3 text-sm text-zinc-400">
                    {displayName(player)} · {slot} of {list.length}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:grid-cols-4 sm:px-6">
              <BioStat label="Grad year" value={bioValue(player.gradYear)} />
              <BioStat label="Position" value={bioValue(player.position)} />
              <BioStat label="Throws" value={bioValue(player.bats)} />
              <BioStat label="Bats" value={bioValue(player.throws)} />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => previous && onSelect(previous)}
                className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
              >
                <ChevronUp className="size-4 shrink-0 text-red-400" />
                <span className="min-w-0">
                  <span className="block text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase">
                    Previous
                  </span>
                  <span className="font-heading block truncate text-lg tracking-wide text-white uppercase">
                    {previous ? displayName(previous) : "—"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => next && onSelect(next)}
                className="inline-flex min-w-0 flex-1 items-center justify-end gap-2 rounded-lg px-2 py-2 text-right transition-colors hover:bg-white/5"
              >
                <span className="min-w-0">
                  <span className="block text-[0.62rem] tracking-[0.18em] text-zinc-500 uppercase">
                    Next
                  </span>
                  <span className="font-heading block truncate text-lg tracking-wide text-white uppercase">
                    {next ? displayName(next) : "—"}
                  </span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-red-400" />
              </button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
