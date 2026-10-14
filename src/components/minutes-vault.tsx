"use client";

import { MinutesPdfViewer, minutesFileUrl } from "@/components/minutes-pdf-viewer";
import { publishMinutesLock } from "@/lib/minutes-session";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

type MinutesFile = {
  name: string;
  size: number;
  uploadedAt: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

function MinutesFileActions({
  file,
  canAdmin,
  removing,
  onRemove,
}: {
  file: MinutesFile;
  canAdmin: boolean;
  removing: boolean;
  onRemove: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pdf = isPdf(file.name);

  return (
    <div className="flex gap-2">
      {pdf ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            className={cn(buttonVariants(), "h-9 px-3 text-xs uppercase")}
          >
            View
          </DialogTrigger>
          {open ? <MinutesPdfViewer name={file.name} /> : null}
        </Dialog>
      ) : null}
      <a
        href={minutesFileUrl(file.name)}
        className={cn(
          buttonVariants({ variant: pdf ? "outline" : "default" }),
          "h-9 px-3 text-xs uppercase",
          pdf && "border-white/15",
        )}
      >
        Download
      </a>
      {canAdmin ? (
        <button
          type="button"
          disabled={removing}
          onClick={() => onRemove(file.name)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 border-white/15 px-3 text-xs uppercase",
          )}
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MinutesVault({
  initialFiles,
  canAdmin,
  documentsUnavailable = false,
  onSessionExpired,
}: {
  initialFiles: MinutesFile[];
  canAdmin: boolean;
  documentsUnavailable?: boolean;
  onSessionExpired?: () => void;
}) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [unavailable, setUnavailable] = useState(documentsUnavailable);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  function applyLibrary(data: { files?: MinutesFile[]; unavailable?: boolean }) {
    if (data.unavailable) {
      setUnavailable(true);
      setFiles([]);
      return;
    }
    setUnavailable(false);
    setFiles(data.files ?? []);
  }

  async function refreshFiles() {
    const response = await fetch("/api/minutes");
    let data: {
      files?: MinutesFile[];
      unavailable?: boolean;
      error?: string;
      expired?: boolean;
    } = {};
    try {
      data = (await response.json()) as typeof data;
    } catch {
      setUnavailable(true);
      setFiles([]);
      return;
    }
    if (response.status === 401) {
      if (data.expired) {
        onSessionExpired?.();
        return;
      }
      throw new Error("Sign in required.");
    }
    if (!response.ok || data.unavailable) {
      setUnavailable(true);
      setFiles([]);
      return;
    }
    applyLibrary(data);
  }

  async function uploadDirect(file: File) {
    const started = await fetch("/api/minutes/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size }),
    });
    const startData = (await started.json()) as {
      url?: string;
      contentType?: string;
      error?: string;
      expired?: boolean;
    };
    if (started.status === 401 && startData.expired) {
      onSessionExpired?.();
      return true;
    }
    if (started.status === 503) return false;
    if (!started.ok || !startData.url) {
      throw new Error(startData.error || "Upload failed.");
    }

    const stored = await fetch(startData.url, {
      method: "PUT",
      headers: {
        "Content-Type": startData.contentType || file.type || "application/pdf",
      },
      body: file,
    });
    if (!stored.ok) {
      const detail = await stored.text().catch(() => "");
      throw new Error(
        detail
          ? `Upload failed (${stored.status}).`
          : "Upload failed. Try again.",
      );
    }
    await refreshFiles();
    return true;
  }

  async function uploadThroughServer(file: File) {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/minutes", { method: "POST", body });
    const data = (await response.json()) as {
      files?: MinutesFile[];
      unavailable?: boolean;
      error?: string;
      expired?: boolean;
    };
    if (response.status === 401 && data.expired) {
      onSessionExpired?.();
      return;
    }
    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }
    applyLibrary(data);
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 80 * 1024 * 1024) {
      setError("File must be 80 MB or smaller.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const usedDirect = await uploadDirect(file);
      if (!usedDirect) await uploadThroughServer(file);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onRemove(name: string) {
    setRemoving(name);
    setError("");
    try {
      const response = await fetch(
        `/api/minutes/file?name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string; expired?: boolean };
        if (response.status === 401 && data.expired) {
          onSessionExpired?.();
          return;
        }
        setError(data.error || "Could not remove that file.");
        return;
      }
      setFiles((current) => current.filter((file) => file.name !== name));
    } catch {
      setError("Could not remove that file.");
    } finally {
      setRemoving(null);
    }
  }

  async function onLock() {
    publishMinutesLock();
    await fetch("/api/minutes/auth", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
            Minutes library
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {canAdmin
              ? "Upload PDF or Word files up to 80 MB. Downloads stay behind the password."
              : "View and download minutes. Only an administrator can add or remove files."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdmin ? (
            <label
              className={cn(
                buttonVariants(),
                "h-10 cursor-pointer px-4 uppercase",
                uploading && "pointer-events-none opacity-50",
              )}
            >
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="application/pdf,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={uploading}
                onChange={onUpload}
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={onLock}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 border-white/15 px-4 uppercase",
            )}
          >
            Log out
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {unavailable ? (
        <p className="mt-8 text-sm text-zinc-300" role="status">
          Documents are temporarily unavailable. Try again in a few minutes.
        </p>
      ) : files.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          {canAdmin
            ? "No minutes uploaded yet. Use Upload to add the first file."
            : "No minutes uploaded yet."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-white/8">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm text-white">{file.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatDate(file.uploadedAt)} · {formatSize(file.size)}
                </p>
              </div>
              <MinutesFileActions
                file={file}
                canAdmin={canAdmin}
                removing={removing === file.name}
                onRemove={onRemove}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
