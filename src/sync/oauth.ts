import { text as uiText } from "../i18n";
import { z } from "zod";
import type { Engine } from "./engine";
/**
 * "Log in with Meldiq" from the person's side (API 0.65.0 batch B, server docs/SETTINGS_PARITY_API.md): the consent
 * page at /oauth/authorize that an app sends people to, and the list of apps they said yes to, each with Revoke.
 * The OAuth parameters keep their standard snake_case names (RFC 6749, RFC 7636).
 */
/** The authorization request as the app put it in the address. */
export interface AuthorizeRequest {
  response_type?: "code";
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}
const LIMITS: Record<keyof AuthorizeRequest, number> = {
  response_type: 10,
  client_id: 64,
  redirect_uri: 500,
  scope: 200,
  state: 500,
  code_challenge: 128,
  code_challenge_method: 10,
};
/**
 * The request in a consent page's query, or what's wrong with it. Only the known parameters are kept, each within the
 * server's limits; the server checks the client and the redirect URI again before anything is shown or sent.
 */
export function parseAuthorizeQuery(search: string):
  | {
      request: AuthorizeRequest;
    }
  | {
      problem: string;
    } {
  const q = new URLSearchParams(search);
  for (const [key, max] of Object.entries(LIMITS))
    if ((q.get(key) ?? "").length > max) return { problem: uiText("workspace.interface.the_app_sent_a_value0_that_s_too_long_9763a7a", { value0: key }) };
  const client_id = q.get("client_id")?.trim() ?? "";
  const redirect_uri = q.get("redirect_uri")?.trim() ?? "";
  if (!client_id || !redirect_uri) return { problem: uiText("workspace.interface.this_sign_in_link_is_missing_the_app_s_details_client_id_and_redi_a44b149") };
  const responseType = q.get("response_type");
  if (responseType && responseType !== "code") return { problem: uiText("workspace.interface.this_app_asked_for_a_kind_of_sign_in_meldiq_doesn_t_offer_9ac98c7") };
  const request: AuthorizeRequest = { client_id, redirect_uri };
  if (responseType) request.response_type = "code";
  for (const key of ["scope", "state", "code_challenge", "code_challenge_method"] as const) {
    const v = q.get(key);
    if (v !== null && v !== "") request[key] = v;
  }
  return { request };
}
/** The request as query parameters (GET /v2/oauth/authorize/info). */
export function authorizeQueryString(r: AuthorizeRequest): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(r)) if (typeof v === "string") q.set(k, v);
  return q.toString();
}
const zAppSummary = z.object({ id: z.string(), name: z.string(), ownerUsername: z.string().nullable() });
export const zAuthorizeInfo = z.object({
  app: zAppSummary,
  scopes: z.array(z.object({ id: z.string(), description: z.string() })),
  redirectUri: z.string(),
  alreadyAuthorized: z.boolean(),
});
export type AuthorizeInfo = z.infer<typeof zAuthorizeInfo>;
export const zGrant = z.object({ app: zAppSummary, scopes: z.array(z.string()), createdAt: z.number(), updatedAt: z.number() });
export type Grant = z.infer<typeof zGrant>;
/** A scope in plain words (the server sends its own description too; ours is used for the ones we know). */
export const SCOPE_WORDS: Record<string, string> = {
  get identify() {
    return uiText("workspace.interface.see_your_username_display_name_and_profile_picture_024788e");
  },
  get email() {
    return uiText("workspace.interface.see_your_email_address_bc80c34");
  },
};
export function authorizeInfo(engine: Engine, r: AuthorizeRequest): Promise<AuthorizeInfo> {
  return engine.api.json("GET", `/v2/oauth/authorize/info?${authorizeQueryString(r)}`, zAuthorizeInfo);
}
/** Allow or Cancel: where the browser goes next (the app's redirect URI with a code, or with error=access_denied). */
export async function authorize(engine: Engine, r: AuthorizeRequest, approve: boolean): Promise<string> {
  return (await engine.api.json("POST", "/v2/oauth/authorize", z.object({ redirect: z.string() }), { body: { ...r, approve } })).redirect;
}
/** Only an http(s) address is followed, so a malformed answer can never run script in this page. */
export function safeRedirect(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
export async function oauthGrants(engine: Engine): Promise<Grant[]> {
  return (await engine.api.json("GET", "/v2/oauth/grants", z.object({ grants: z.array(zGrant) }))).grants;
}
/** The app's tokens stop working at once. */
export async function revokeGrant(engine: Engine, clientId: string): Promise<void> {
  await engine.api.call("DELETE", `/v2/oauth/grants/${encodeURIComponent(clientId)}`);
}
