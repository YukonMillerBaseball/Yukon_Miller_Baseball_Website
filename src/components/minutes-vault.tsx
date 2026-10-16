"use client";

import { MinutesPdfViewer, minutesFileUrl } from "@/components/minutes-pdf-viewer";
import { publishMinutesLock } from "@/lib/minutes-session";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [duplicate, setDuplicate] = useState<{
    file: File;
    name: string;
    etag: string;
  } | null>(null);

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

  function rememberDuplicate(
    file: File,
    data: { exists?: boolean; name?: string; etag?: string },
  ) {
    if (!data.exists || !data.name || !data.etag) return false;
    setDuplicate({ file, name: data.name, etag: data.etag });
    return true;
  }

  async function uploadDirect(
    file: File,
    authorization: { replace: boolean; etag?: string },
  ) {
    const started = await fetch("/api/minutes/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        replace: authorization.replace,
        etag: authorization.etag,
      }),
    });
    const startData = (await started.json()) as {
      url?: string;
      contentType?: string;
      error?: string;
      expired?: boolean;
      exists?: boolean;
      name?: string;
      etag?: string;
    };
    if (started.status === 401 && startData.expired) {
      onSessionExpired?.();
      return "expired" as const;
    }
    if (started.status === 409 && rememberDuplicate(file, startData)) {
      return "duplicate" as const;
    }
    if (started.status === 503) return "fallback" as const;
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
      if (stored.status === 409 || stored.status === 412) {
        setDuplicate(null);
        setError(
          "The existing document was kept because it changed during the upload.",
        );
        await refreshFiles().catch(() => undefined);
        return "kept" as const;
      }
      throw new Error("Upload failed. Try again.");
    }
    setDuplicate(null);
    await refreshFiles();
    return "stored" as const;
  }

  async function uploadThroughServer(
    file: File,
    authorization: { replace: boolean; etag?: string },
  ) {
    const body = new FormData();
    body.set("file", file);
    if (authorization.replace) {
      body.set("replace", "1");
      body.set("etag", authorization.etag ?? "");
    }
    const response = await fetch("/api/minutes", { method: "POST", body });
    const data = (await response.json()) as {
      files?: MinutesFile[];
      unavailable?: boolean;
      error?: string;
      expired?: boolean;
      exists?: boolean;
      name?: string;
      etag?: string;
    };
    if (response.status === 401 && data.expired) {
      onSessionExpired?.();
      return;
    }
    if (response.status === 409 && rememberDuplicate(file, data)) return;
    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }
    setDuplicate(null);
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

    setDuplicate(null);
    await sendUpload(file, { replace: false });
  }

  async function sendUpload(
    file: File,
    authorization: { replace: boolean; etag?: string },
  ) {
    setUploading(true);
    setError("");
    try {
      const direct = await uploadDirect(file, authorization);
      if (direct === "fallback") await uploadThroughServer(file, authorization);
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
    const response = await fetch("/api/minutes/auth", { method: "DELETE" }).catch(
      () => null,
    );
    if (!response?.ok) {
      setError("Could not sign out. Try again.");
      return;
    }
    publishMinutesLock();
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
      <Dialog
        open={duplicate !== null}
        onOpenChange={(open) => {
          if (!open && !uploading) setDuplicate(null);
        }}
      >
        <DialogContent className="bg-zinc-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white uppercase">
              Document already exists
            </DialogTitle>
            <DialogDescription className="space-y-3 text-sm leading-6 text-zinc-400">
              <span className="block">
                A document with this filename is already stored in Meeting
                Minutes.
              </span>
              <span className="block">
                Uploading this file could replace the existing document.
              </span>
              <span className="block text-zinc-300">
                What would you like to do?
              </span>
              {duplicate ? (
                <span className="block text-xs break-all text-zinc-500">
                  {duplicate.name}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              disabled={uploading}
              onClick={() => setDuplicate(null)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full border-white/15 px-4 uppercase sm:w-auto",
              )}
            >
              Cancel upload
            </button>
            <button
              type="button"
              disabled={uploading || !duplicate}
              onClick={() => {
                if (!duplicate) return;
                const pending = duplicate;
                void sendUpload(pending.file, {
                  replace: true,
                  etag: pending.etag,
                });
              }}
              className={cn(buttonVariants(), "h-11 w-full px-4 uppercase sm:w-auto")}
            >
              {uploading ? "Uploading…" : "Replace existing file"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
