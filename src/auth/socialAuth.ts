import { text as uiText } from "../i18n";
import { z } from "zod";
import { ApiClient, ApiError } from "../api/client";
import { zAccountSession } from "../api/accountSchemas";
export type SocialProvider = "google" | "apple" | "discord";
export const zSocialConfig = z.object({ providers: z.array(z.enum(["google", "apple", "discord"])), googleClientId: z.string().nullable() });
export const zConnections = z.object({
  password: z.boolean(),
  identities: z.array(z.object({ provider: z.enum(["google", "apple", "discord"]), email: z.string().nullable(), connectedAt: z.number() })),
  providers: z.array(z.enum(["google", "apple", "discord"])),
});
const zStarted = z.object({ id: z.string(), authorizeUrl: z.string().url(), expiresAt: z.number() });
const zCompleted = z.union([z.object({ linked: z.literal(true) }), z.object({ grant: zAccountSession })]);
export interface SocialReceipt {
  id: string;
  verifier: string;
  receipt: string;
}
const random = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export async function socialChallenge(verifier: string): Promise<string> {
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
/** One-use receipts return over a same-origin channel or the checked popup; provider isolation may sever window.opener. */
export async function startSocial(
  api: ApiClient,
  popup: Window,
  provider: SocialProvider,
  options: {
    mode?: "login" | "link";
    password?: string;
    totpCode?: string;
  },
  signal: AbortSignal,
): Promise<SocialReceipt> {
  const verifier = random();
  const started = await api.json("POST", "/v2/auth/social/start", zStarted, {
    body: { provider, challenge: await socialChallenge(verifier), platform: "web", mode: options.mode ?? "login", password: options.password || undefined, totpCode: options.totpCode || undefined },
    auth: options.mode === "link",
    signal,
  });
  const authorize = new URL(started.authorizeUrl);
  if (![new URL(api.base || location.origin).origin, location.origin].includes(authorize.origin) || authorize.pathname !== `/v2/auth/social/authorize/${started.id}`)
    throw new Error(uiText("auth.interface.the_server_returned_an_unexpected_sign_in_address_af8a646"));
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  return new Promise((resolve, reject) => {
    let settled = false;
    // Google can move the popup into another browsing-context group (especially Safari).
    // BroadcastChannel survives that separation without weakening the verifier/receipt proof.
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(`meldiq-social:${started.id}`);
    } catch {
      /* Keep the checked postMessage fallback when storage is unavailable. */
    }
    const acknowledge = () => channel?.postMessage({ type: "meldiq-social-ack", id: started.id });
    const cleanup = () => {
      settled = true;
      channel?.close();
      clearInterval(timer);
      window.removeEventListener("message", receive);
      signal.removeEventListener("abort", abort);
      try {
        popup.close();
      } catch {
        /* Provider isolation may make the old window handle unusable. */
      }
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const abort = () => fail(uiText("auth.interface.sign_in_cancelled_you_can_try_again_97a6c7a"));
    const accept = (data: unknown) => {
      if (settled || !data || typeof data !== "object") return;
      const message = data as {
        type?: unknown;
        id?: unknown;
        receipt?: unknown;
        error?: unknown;
      };
      if (message.type !== "meldiq-social" || message.id !== started.id) return;
      if (message.error) {
        acknowledge();
        return fail(
          message.error === "cancelled" ? uiText("auth.interface.sign_in_cancelled_you_can_try_again_97a6c7a") : uiText("auth.interface.the_provider_couldn_t_verify_this_sign_in_try_again_2427fe8"),
        );
      }
      if (typeof message.receipt !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(message.receipt)) return;
      acknowledge();
      cleanup();
      resolve({ id: started.id, verifier, receipt: message.receipt });
    };
    const receive = (e: MessageEvent) => {
      if (e.origin === location.origin && e.source === popup) accept(e.data);
    };
    if (channel) channel.onmessage = (e: MessageEvent) => accept(e.data);
    window.addEventListener("message", receive);
    signal.addEventListener("abort", abort, { once: true });
    const timer = setInterval(() => {
      // A detached popup reports closed=true while the provider is still visibly open.
      // Cancellation is explicit; a verified return or the flow deadline ends the wait.
      if (Date.now() >= started.expiresAt) fail(uiText("auth.interface.sign_in_expired_please_try_again_1d52123"));
    }, 500);
    popup.location.href = authorize.href;
  });
}
export async function completeSocial(
  api: ApiClient,
  receipt: SocialReceipt,
  details: {
    name?: string;
    inviteCode?: string;
    totpCode?: string;
    deviceName: string;
    device?: {
      deviceId: string;
      nonce: string;
      signature: string;
    };
  },
  link = false,
) {
  return api.json("POST", "/v2/auth/social/complete", zCompleted, { body: { ...receipt, ...details }, auth: link });
}
export function socialError(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : uiText("auth.interface.couldn_t_sign_in_please_try_again_31e18bd");
}
export const socialProviderName = (provider: SocialProvider) => ({ google: "Google", apple: "Apple", discord: "Discord" })[provider];
