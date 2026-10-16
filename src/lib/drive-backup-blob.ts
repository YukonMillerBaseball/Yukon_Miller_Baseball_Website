import "server-only";

import { get, list } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import {
  BackupRunError,
  selectBackupSources,
  classifyBackupPath,
  isBackupEtag,
  type BackupBlobReader,
} from "@/lib/drive-backup";

/**
 * Private Blob reads use Vercel OIDC.
 * In @vercel/blob, the `token` option is a read-write token and is accepted
 * before OIDC, so this reader never sets it. `oidcToken` and `storeId`
 * select the OIDC path and do not fall through to the read-write token.
 */

const BACKUP_PREFIXES = ["minutes/", "media-library/"] as const;

export type OidcBlobReadOptions = {
  storeId: string;
  oidcToken: string;
  access: "private";
  useCache: false;
};

export type BackupBlobPage = {
  blobs: { pathname: string; size: number; etag?: string; uploadedAt?: string }[];
  hasMore: boolean;
  cursor?: string;
};

export type BackupBlobGetResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  blob?: { etag?: string | null; size?: number | null };
} | null;

export function backupBlobRecord(blob: {
  pathname: string;
  size: number;
  etag: string;
  uploadedAt: Date;
  url?: string;
  downloadUrl?: string;
}) {
  return {
    pathname: blob.pathname,
    size: blob.size,
    etag: blob.etag.trim(),
    uploadedAt: blob.uploadedAt.toISOString(),
  };
}

export function oidcBlobReadOptions(
  env: NodeJS.Dict<string>,
  oidcToken: string,
): OidcBlobReadOptions | null {
  const storeId = env.BLOB_STORE_ID?.trim() ?? "";
  const token = oidcToken.trim();
  if (!storeId || !token) return null;
  return {
    storeId,
    oidcToken: token,
    access: "private",
    useCache: false,
  };
}

export function createOidcBackupBlobReader(
  options: OidcBlobReadOptions,
  io: {
    listPage: (args: {
      prefix: string;
      cursor?: string;
      limit: number;
      oidcToken: string;
      storeId: string;
    }) => Promise<BackupBlobPage>;
    getBlob: (pathname: string, options: OidcBlobReadOptions) => Promise<BackupBlobGetResult>;
  },
): BackupBlobReader {
  return {
    async list() {
      const found: { pathname: string; size: number; etag?: string; uploadedAt?: string }[] = [];
      for (const prefix of BACKUP_PREFIXES) {
        let cursor: string | undefined;
        let pages = 0;
        do {
          pages += 1;
          if (pages > 50) throw new BackupRunError("source");
          let page: BackupBlobPage;
          try {
            page = await io.listPage({
              prefix,
              cursor,
              limit: 1000,
              oidcToken: options.oidcToken,
              storeId: options.storeId,
            });
          } catch (error) {
            if (error instanceof BackupRunError) throw error;
            throw new BackupRunError("source");
          }
          for (const blob of page.blobs) {
            found.push({
              pathname: blob.pathname,
              size: blob.size,
              etag: blob.etag,
              uploadedAt: blob.uploadedAt,
            });
          }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
      }
      return selectBackupSources(found);
    },
    async open(pathname) {
      if (classifyBackupPath(pathname) !== "include") throw new BackupRunError("source");
      let result: BackupBlobGetResult;
      try {
        result = await io.getBlob(pathname, options);
      } catch (error) {
        if (error instanceof BackupRunError) throw error;
        throw new BackupRunError("source");
      }
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new BackupRunError("source");
      }
      const etag = result.blob?.etag?.trim() ?? "";
      const size = result.blob?.size;
      if (!isBackupEtag(etag) || typeof size !== "number" || !Number.isInteger(size) || size < 0) {
        throw new BackupRunError("source");
      }
      return { stream: result.stream, etag, size };
    },
  };
}

export async function createBackupBlobReader(): Promise<BackupBlobReader> {
  let oidcToken = "";
  try {
    oidcToken = await getVercelOidcToken();
  } catch {
    throw new BackupRunError("configuration");
  }
  const options = oidcBlobReadOptions(process.env, oidcToken);
  if (!options) throw new BackupRunError("configuration");
  return createOidcBackupBlobReader(options, {
    async listPage(args) {
      const page = await list(args);
      return {
        blobs: page.blobs.map((blob) => backupBlobRecord(blob)),
        hasMore: page.hasMore,
        cursor: page.cursor,
      };
    },
    async getBlob(pathname, readOptions) {
      const result = await get(pathname, readOptions);
      if (!result) return null;
      return {
        statusCode: result.statusCode,
        stream: result.stream,
        blob: { etag: result.blob.etag, size: result.blob.size },
      };
    },
  });
}
