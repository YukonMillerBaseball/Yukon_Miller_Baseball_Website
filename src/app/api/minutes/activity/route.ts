import { privateJson, requireMinutes } from "@/lib/minutes-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const { access, response } = await requireMinutes({ touch: true });
  if (response) return response;
  if (access.state !== "active") {
    return privateJson({ error: "Sign in required." }, { status: 401 });
  }
  return privateJson({
    ok: true,
    admin: access.role === "admin",
    lastActivity: access.lastActivity,
  });
}
