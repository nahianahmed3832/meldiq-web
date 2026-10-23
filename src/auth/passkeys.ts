import type { AccountSessionGrant } from "../api/accountSchemas";
import type { ServerInfo } from "../api/schemas";
import type { AccountApi, Passkey } from "./accountApi";

/**
 * Passkeys in the browser (server docs/PASSKEYS.md, API 0.30.0). The server sends WebAuthn options as JSON with base64url
 * fields and verifies the browser's answer in the same JSON form; this turns one into the other around
 * navigator.credentials. The web is a relying party of its own (its host, e.g. web.meldiq.app), offered only when
 * server-info lists this page's origin: passkeys made in the Android app belong to the server's host and a browser
 * won't use them here.
 */

/** The person closed the browser's passkey prompt, or it timed out: nothing to report. */
export class PasskeyCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "PasskeyCancelled";
  }
}

/** The browser refused for a reason the person can act on; [message] is written for them. */
export class PasskeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasskeyError";
  }
}

/** Whether this browser has WebAuthn at all (not in a very old browser or an insecure page). */
export const webAuthnSupported = (): boolean => typeof PublicKeyCredential !== "undefined" && typeof navigator !== "undefined" && !!navigator.credentials;

/** The relying party this page uses with [info]'s server (its own host), or null when passkeys aren't offered here. */
export function passkeyRpId(
  info: Pick<ServerInfo, "passkeys"> | null | undefined,
  origin: string = typeof location === "undefined" ? "" : location.origin,
  supported: boolean = webAuthnSupported(),
): string | null {
  if (!supported || !origin || !info?.passkeys?.webOrigins.includes(origin)) return null;
  return new URL(origin).hostname;
}

export function fromBase64url(s: string): ArrayBuffer {
  const b64 = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function toBase64url(b: ArrayBuffer | ArrayBufferView): string {
  const bytes = b instanceof ArrayBuffer ? new Uint8Array(b) : new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface CredentialDescriptorJSON {
  id: string;
  type: string;
  transports?: string[];
}

const descriptor = (d: CredentialDescriptorJSON): PublicKeyCredentialDescriptor => ({
  id: fromBase64url(d.id),
  type: d.type as PublicKeyCredentialType,
  ...(d.transports ? { transports: d.transports as AuthenticatorTransport[] } : {}),
});

/** The server's create options (POST /v2/account/passkeys/options) as navigator.credentials.create wants them. */
export function creationOptions(json: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const o = json as unknown as PublicKeyCredentialCreationOptions & { challenge: string; user: { id: string }; excludeCredentials?: CredentialDescriptorJSON[] };
  return {
    ...o,
    challenge: fromBase64url(o.challenge),
    user: { ...o.user, id: fromBase64url(o.user.id) },
    excludeCredentials: (o.excludeCredentials ?? []).map(descriptor),
  };
}

/** The server's sign-in options (POST /v2/auth/passkey/options) as navigator.credentials.get wants them. */
export function requestOptions(json: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const o = json as unknown as PublicKeyCredentialRequestOptions & { challenge: string; allowCredentials?: CredentialDescriptorJSON[] };
  return { ...o, challenge: fromBase64url(o.challenge), allowCredentials: (o.allowCredentials ?? []).map(descriptor) };
}

/** A new passkey as the server reads it (RegistrationResponseJSON). */
export function registrationJSON(c: PublicKeyCredential): Record<string, unknown> {
  const r = c.response as AuthenticatorAttestationResponse;
  return {
    id: c.id,
    rawId: toBase64url(c.rawId),
    type: c.type,
    response: {
      clientDataJSON: toBase64url(r.clientDataJSON),
      attestationObject: toBase64url(r.attestationObject),
      transports: typeof r.getTransports === "function" ? r.getTransports() : [],
    },
    clientExtensionResults: c.getClientExtensionResults(),
    authenticatorAttachment: c.authenticatorAttachment ?? undefined,
  };
}

/** A passkey's signed answer as the server reads it (AuthenticationResponseJSON). */
export function authenticationJSON(c: PublicKeyCredential): Record<string, unknown> {
  const r = c.response as AuthenticatorAssertionResponse;
  return {
    id: c.id,
    rawId: toBase64url(c.rawId),
    type: c.type,
    response: {
      clientDataJSON: toBase64url(r.clientDataJSON),
      authenticatorData: toBase64url(r.authenticatorData),
      signature: toBase64url(r.signature),
      ...(r.userHandle ? { userHandle: toBase64url(r.userHandle) } : {}),
    },
    clientExtensionResults: c.getClientExtensionResults(),
    authenticatorAttachment: c.authenticatorAttachment ?? undefined,
  };
}

/**
 * What a browser refusal means to the person. NotAllowedError is both "closed the prompt" and "timed out", so it is a
 * cancellation; InvalidStateError on create is a passkey this account already has in this password manager.
 */
function platformError(e: unknown, creating: boolean): Error {
  const name = e instanceof DOMException || e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return new PasskeyCancelled();
  if (creating && name === "InvalidStateError") return new PasskeyError("This browser's password manager already has a passkey for this account.");
  if (name === "SecurityError") return new PasskeyError("This browser won't use passkeys on this address.");
  return new PasskeyError(creating ? "This browser couldn't make a passkey. Try again, or use another browser." : "This browser couldn't use a passkey. Try again, or sign in with your password.");
}

/** Shows the browser's create-passkey prompt for [options]; the answer is for POST /v2/account/passkeys. */
export async function createPasskey(options: Record<string, unknown>): Promise<Record<string, unknown>> {
  let c: Credential | null;
  try {
    c = await navigator.credentials.create({ publicKey: creationOptions(options) });
  } catch (e) {
    throw platformError(e, true);
  }
  if (!(c instanceof PublicKeyCredential)) throw new PasskeyCancelled();
  return registrationJSON(c);
}

/** Shows the browser's passkey prompt for [options]; the answer is for POST /v2/auth/passkey/login. */
export async function getPasskey(options: Record<string, unknown>): Promise<Record<string, unknown>> {
  let c: Credential | null;
  try {
    c = await navigator.credentials.get({ publicKey: requestOptions(options) });
  } catch (e) {
    throw platformError(e, false);
  }
  if (!(c instanceof PublicKeyCredential)) throw new PasskeyCancelled();
  return authenticationJSON(c);
}

/** Signs in with one of the person's passkeys for [rpId]: the server's options, the browser's prompt, the server's verdict. */
export async function signInWithPasskey(accounts: AccountApi, rpId: string, deviceName: string): Promise<AccountSessionGrant> {
  const { challengeId, options } = await accounts.passkeyLoginOptions(rpId);
  return accounts.passkeyLogin(challengeId, await getPasskey(options), deviceName);
}

/** Adds a passkey for [rpId] to the signed-in account, named [name] in its list. */
export async function addPasskey(accounts: AccountApi, rpId: string, name: string): Promise<Passkey> {
  const { challengeId, options } = await accounts.passkeyCreateOptions(rpId);
  return accounts.addPasskey(challengeId, await createPasskey(options), name);
}
