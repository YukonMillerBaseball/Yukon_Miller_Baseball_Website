import "server-only";

import { ExternalAccountClient } from "google-auth-library";
import { getVercelOidcToken } from "@vercel/oidc";
import {
  DriveAccessError,
  type DriveAccessConfig,
  workloadIdentityOptions,
} from "@/lib/drive-access-check";

export async function mintDriveAccessToken(config: DriveAccessConfig) {
  try {
    const client = ExternalAccountClient.fromJSON({
      ...workloadIdentityOptions(config),
      subject_token_supplier: {
        getSubjectToken: () => getVercelOidcToken(),
      },
    });
    if (!client) throw new DriveAccessError("authentication");
    const minted = await client.getAccessToken();
    const token = minted.token;
    if (!token) throw new DriveAccessError("authentication");
    return token;
  } catch (error) {
    if (error instanceof DriveAccessError) throw error;
    throw new DriveAccessError("authentication");
  }
}
