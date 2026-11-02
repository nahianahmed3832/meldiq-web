import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalStore } from "../store/db";
import { createMeldiqSupabase, EncryptedSupabaseStorage } from "./supabaseClient";
import { AuthMigrationError, prepareLegacySupabaseLink, type ExistingOwner, type PreparedAuthBinding } from "./supabaseMigration";
import type { SupabasePreviewConfig } from "./supabasePreviewConfig";

interface PreviewOptions {
  provider: SupabasePreviewConfig;
  store: LocalStore;
  apiOrigin: string;
  owner: ExistingOwner;
  legacyAccessToken: string;
  email: string;
  password: string;
  legacyPassword?: string;
  totpCode?: string;
  signal?: AbortSignal;
  isCurrentOwner(): boolean;
  signDeviceProof(message: string): Promise<string>;
}
interface PreviewDependencies {
  client?: (key: string) => SupabaseClient;
  fetch?: typeof fetch;
}

/** A staging-only rehearsal. It never adopts a new API bearer, starts Realtime or touches legacy/offline data. */
export async function checkSupabaseSignIn(options: PreviewOptions, dependencies: PreviewDependencies = {}): Promise<PreparedAuthBinding> {
  if (!/^[^\s@]+@example\.(?:test|invalid)$/i.test(options.email)) throw new AuthMigrationError("synthetic_account_required");
  const guard = () => {
    if (options.signal?.aborted || !options.isCurrentOwner()) throw new AuthMigrationError("preview_cancelled");
  };
  guard();
  const origin = new URL(options.apiOrigin);
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
  )
    throw new AuthMigrationError("invalid_api_origin");
  const key = `meldiq-supabase-preview:${crypto.randomUUID()}`;
  const storage = new EncryptedSupabaseStorage(options.store);
  const client = dependencies.client?.(key) ?? createMeldiqSupabase(options.provider, options.store, { storageKey: key, autoRefreshToken: false });
  const request = dependencies.fetch ?? globalThis.fetch;
  let token: string | undefined,
    linked = false;
  const revoke = async () => {
    if (!token || !linked) return;
    const response = await request(`${origin.origin}/v3/auth/session`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok && response.status !== 401) throw new AuthMigrationError("preview_cleanup_failed");
  };
  let result: PreparedAuthBinding | undefined;
  let failure: unknown;
  try {
    const signedIn = await client.auth.signInWithPassword({ email: options.email, password: options.password });
    if (signedIn.error || !signedIn.data.session) throw new AuthMigrationError("provider_sign_in_failed");
    const session = signedIn.data.session;
    token = session.access_token;
    guard();
    const receipt = await prepareLegacySupabaseLink({
      apiOrigin: origin.origin,
      providerSession: session,
      expectedOwner: { ...options.owner },
      legacyAccessToken: options.legacyAccessToken,
      password: options.legacyPassword,
      totpCode: options.totpCode,
      signal: options.signal,
      fetch: request,
      signDeviceProof: async (message) => {
        guard();
        const signed = await options.signDeviceProof(message);
        guard();
        return signed;
      },
    });
    linked = true;
    guard();
    const current = await client.auth.getSession();
    if (current.error || current.data.session?.access_token !== token || current.data.session.user.id !== receipt.authUserId) throw new AuthMigrationError("provider_session_changed");
    result = receipt;
  } catch (error) {
    failure = error instanceof AuthMigrationError ? error : new AuthMigrationError("preview_failed");
  }
  // Even after cancellation, end this isolated test session. Cleanup uses its own bounded signal.
  let cleanupFailed = false;
  try {
    await revoke();
  } catch {
    cleanupFailed = true;
  }
  try {
    if ((await client.auth.signOut({ scope: "local" })).error) cleanupFailed = true;
  } catch {
    cleanupFailed = true;
  }
  try {
    await client.auth.dispose();
    client.realtime.disconnect();
  } catch {
    cleanupFailed = true;
  }
  for (const entry of [key, `${key}-user`, `${key}-code-verifier`]) {
    try {
      await storage.removeItem(entry);
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) throw new AuthMigrationError("preview_cleanup_failed");
  if (failure) throw failure;
  guard();
  return result!;
}
