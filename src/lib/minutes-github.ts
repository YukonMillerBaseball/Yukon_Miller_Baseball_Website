import "server-only";

type MinutesFile = {
  name: string;
  size: number;
  uploadedAt: string;
};

const OWNER = "ryanphillips2505";
const REPO = "yukon-miller-minutes";
const PREFIX = "files/";

function token() {
  return process.env.MINUTES_GITHUB_TOKEN || "";
}

export function minutesUsesGithub() {
  return Boolean(token());
}

async function gh(path: string, init?: RequestInit) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers as Record<string, string>),
      },
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: string }).message)
        : `GitHub ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function listGithubMinutes(): Promise<MinutesFile[]> {
  const data = (await gh(`/contents/${PREFIX}`)) as Array<{
    name: string;
    size: number;
    sha: string;
  }>;
  if (!Array.isArray(data)) return [];
  return data
    .filter((file) => file.name && file.name !== ".gitkeep")
    .map((file) => ({
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function shaFor(name: string) {
  try {
    const data = (await gh(`/contents/${PREFIX}${encodeURIComponent(name)}`)) as {
      sha?: string;
    };
    return data.sha;
  } catch {
    return undefined;
  }
}

function minutesNamesMatch(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "accent" }) === 0;
}

export async function findGithubMinutesRecord(target: string) {
  let data: unknown;
  try {
    data = await gh(`/contents/${PREFIX}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not Found") return null;
    throw error;
  }
  if (!Array.isArray(data)) return null;
  const match = data.find(
    (file): file is { name: string; sha: string } =>
      Boolean(file) &&
      typeof file === "object" &&
      "name" in file &&
      "sha" in file &&
      typeof file.name === "string" &&
      typeof file.sha === "string" &&
      minutesNamesMatch(file.name, target),
  );
  return match ? { name: match.name, etag: match.sha } : null;
}

export async function saveGithubMinutes(
  name: string,
  bytes: Uint8Array,
  mode: { replace: false } | { replace: true; etag: string },
) {
  const body: { message: string; content: string; sha?: string } = {
    message: mode.replace ? `Update ${name}` : `Upload ${name}`,
    content: Buffer.from(bytes).toString("base64"),
  };
  if (mode.replace) body.sha = mode.etag;
  try {
    await gh(`/contents/${PREFIX}${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/sha|conflict/i.test(message)) {
      const existing = await findGithubMinutesRecord(name).catch(() => null);
      const conflict = new Error(
        "A document with this filename is already stored in Meeting Minutes.",
      );
      conflict.name = "MinutesConflictError";
      Object.assign(conflict, {
        storedName: existing?.name ?? name,
        etag: existing?.etag ?? "",
      });
      throw conflict;
    }
    throw error;
  }
}

export async function readGithubMinutes(name: string) {
  try {
    const data = (await gh(
      `/contents/${PREFIX}${encodeURIComponent(name)}`,
    )) as { content?: string; encoding?: string };
    if (!data.content) return null;
    return new Uint8Array(Buffer.from(data.content, "base64"));
  } catch {
    return null;
  }
}

export async function deleteGithubMinutes(name: string) {
  const sha = await shaFor(name);
  if (!sha) return;
  await gh(`/contents/${PREFIX}${encodeURIComponent(name)}`, {
    method: "DELETE",
    body: JSON.stringify({
      message: `Remove ${name}`,
      sha,
    }),
  });
}
