import { text as uiText } from "../i18n";
/** Opt-in migration transport. It never changes device keys, offline state, stored legacy sessions or active UI auth. */
export interface ProviderSession {
  access_token: string;
  user: {
    id: string;
  };
}
export interface ExistingOwner {
  accountId: string;
  userId: string;
  deviceId: string;
}
export interface PreparedAuthBinding extends ExistingOwner {
  authUserId: string;
  providerSessionId: string;
}
interface Options {
  apiOrigin: string;
  providerSession: ProviderSession;
  expectedOwner: ExistingOwner;
  /** Sign using the existing protected device key; never export or upload the key itself. */
  signDeviceProof(message: string): Promise<string>;
  totpCode?: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = /^[A-Za-z0-9_-]{1,64}$/;
const publicFailureCodes = new Set([
  "unauthorized",
  "invalid_credentials",
  "fresh_auth_required",
  "totp_required",
  "totp_invalid",
  "totp_locked",
  "invalid_code",
  "invalid_proof",
  "device_revoked",
  "account_disabled",
  "session_expired",
  "session_revoked",
  "conflict",
  "rate_limited",
  "bad_request",
  "unavailable",
  "internal",
  "device_required",
]);
export class AuthMigrationError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super(uiText("auth.interface.account_migration_could_not_be_completed_4dd6f20"));
    this.name = "AuthMigrationError";
  }
}
function providerIdentity(provider: ProviderSession) {
  try {
    if (!uuid.test(provider.user.id) || provider.access_token.length > 16384) throw new Error();
    const parts = provider.access_token.split(".");
    if (parts.length !== 3) throw new Error();
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload + "=".repeat((4 - (payload.length % 4)) % 4)), (c) => c.charCodeAt(0))));
    if (
      !claims ||
      typeof claims !== "object" ||
      !("sub" in claims) ||
      claims.sub !== provider.user.id ||
      !("session_id" in claims) ||
      typeof claims.session_id !== "string" ||
      !uuid.test(claims.session_id)
    )
      throw new Error();
    // Parsing supplies signature context only. The API verifies JWT signature, issuer, ownership and live state.
    return { authUserId: provider.user.id, sessionId: claims.session_id };
  } catch {
    throw new AuthMigrationError("invalid_provider_session");
  }
}
function transport(options: Options) {
  let origin: URL;
  try {
    origin = new URL(options.apiOrigin);
  } catch {
    throw new AuthMigrationError("invalid_api_origin");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((origin.protocol !== "https:" && !(loopback && origin.protocol === "http:")) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
    throw new AuthMigrationError("invalid_api_origin");
  const request = options.fetch ?? globalThis.fetch;
  return async (method: "GET" | "POST" | "DELETE", route: string, body?: unknown): Promise<unknown> => {
    const response = await request(`${origin.origin}${route}`, {
      method,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      signal: options.signal,
      headers: {
        authorization: `Bearer ${options.providerSession.access_token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      let code = "migration_request_failed";
      try {
        const failure = (await response.json()) as {
          error?: {
            code?: unknown;
          };
        };
        if (typeof failure.error?.code === "string" && publicFailureCodes.has(failure.error.code)) code = failure.error.code;
      } catch {
        /* Never include server response bodies or credentials in error messages. */
      }
      throw new AuthMigrationError(code, response.status);
    }
    try {
      return await response.json();
    } catch {
      throw new AuthMigrationError("invalid_server_response");
    }
  };
}
async function prepare(
  options: Options,
  legacy?: {
    accessToken: string;
    password?: string;
  },
): Promise<PreparedAuthBinding> {
  const session = { access_token: options.providerSession.access_token, user: { id: options.providerSession.user.id } };
  const identity = providerIdentity(session);
  if (![options.expectedOwner.accountId, options.expectedOwner.userId, options.expectedOwner.deviceId].every((value) => typeof value === "string" && id.test(value)))
    throw new AuthMigrationError("invalid_existing_owner");
  if (legacy && (legacy.accessToken.length < 20 || legacy.accessToken.length > 200)) throw new AuthMigrationError("invalid_legacy_session");
  const request = transport({ ...options, providerSession: session });
  const challenge = (await request("POST", "/v1/auth/challenge")) as {
    nonce?: unknown;
    expiresAt?: unknown;
  };
  if (
    !challenge ||
    typeof challenge.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(challenge.nonce) ||
    typeof challenge.expiresAt !== "number" ||
    !Number.isSafeInteger(challenge.expiresAt) ||
    challenge.expiresAt <= Date.now()
  )
    throw new AuthMigrationError("invalid_device_challenge");
  const signature = await options.signDeviceProof(`meldiq-supabase-device-v1
${identity.authUserId}
${identity.sessionId}
${options.expectedOwner.deviceId}
${challenge.nonce}`);
  if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) throw new AuthMigrationError("invalid_device_signature");
  const bound = (await request("POST", legacy ? "/v3/auth/legacy-link" : "/v3/auth/device", {
    deviceId: options.expectedOwner.deviceId,
    nonce: challenge.nonce,
    signature,
    ...(options.totpCode ? { totpCode: options.totpCode } : {}),
    ...(legacy ? { legacyAccessToken: legacy.accessToken, ...(legacy.password ? { password: legacy.password } : {}) } : {}),
  })) as {
    ok?: unknown;
  };
  if (!bound || bound.ok !== true) throw new AuthMigrationError("invalid_server_response");
  const owner = (await request("GET", "/v3/auth/me")) as {
    authUserId?: unknown;
    accountId?: unknown;
    userId?: unknown;
  };
  if (!owner || owner.authUserId !== identity.authUserId || owner.accountId !== options.expectedOwner.accountId || owner.userId !== options.expectedOwner.userId)
    throw new AuthMigrationError("identity_mismatch");
  return {
    accountId: options.expectedOwner.accountId,
    userId: options.expectedOwner.userId,
    deviceId: options.expectedOwner.deviceId,
    authUserId: identity.authUserId,
    providerSessionId: identity.sessionId,
  };
}
/** Return a verified binding receipt. The caller must fence the current SDK session before switching API auth. */
export function prepareLegacySupabaseLink(
  options: Options & {
    legacyAccessToken: string;
    password?: string;
  },
): Promise<PreparedAuthBinding> {
  return prepare(options, { accessToken: options.legacyAccessToken, password: options.password });
}
/** A later provider login can authorize only an already-certified device of its explicitly mapped owner. */
export function prepareSupabaseDevice(options: Options): Promise<PreparedAuthBinding> {
  return prepare(options);
}
