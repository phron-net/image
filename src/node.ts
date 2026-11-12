import { createHmac } from "node:crypto";
import { hexToBytes, resolveBaseUrl, type SignParams, signedPathOf } from "./core.js";

export type SignUrlSyncParams = SignParams & { baseUrl?: string; label?: string };

/**
 * Synchronous variant of `signUrl`, for Node only (it uses `node:crypto`). Produces the same
 * URL. Server-side only: `key` and `salt` must never reach a browser.
 */
export function signUrlSync(params: SignUrlSyncParams): string {
  const base = resolveBaseUrl(params);
  const signedPath = signedPathOf(params);
  const signature = createHmac("sha256", hexToBytes(params.key))
    .update(hexToBytes(params.salt))
    .update(signedPath)
    .digest("base64url");
  return `${base}/${signature}${signedPath}`;
}
