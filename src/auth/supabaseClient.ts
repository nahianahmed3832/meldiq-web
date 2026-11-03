import { text as uiText } from "../i18n";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { LocalStore } from "../store/db";
import { copy, utf8, fromUtf8, randomBytes } from "../crypto/bytes";
const WRAPPING_KEY = "supabase:wrapping-key:v1";
const entry = (key: string) => `supabase:sealed:${key}`;
interface SealedValue {
  version: 1;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}
/** Supabase's storage adapter uses the existing device IndexedDB, never plaintext localStorage. */
export class EncryptedSupabaseStorage {
  private wrappingKey: Promise<CryptoKey> | undefined;
  constructor(private readonly store: LocalStore) {}
  private key(): Promise<CryptoKey> {
    this.wrappingKey ??= this.loadOrCreateKey().catch((error: unknown) => {
      this.wrappingKey = undefined;
      throw error;
    });
    return this.wrappingKey;
  }
  private async loadOrCreateKey(): Promise<CryptoKey> {
    const existing = await this.store.legacy.get("kv", WRAPPING_KEY);
    if (existing instanceof CryptoKey) return existing;
    // Generate before opening IDB's transaction. The transaction then serializes creation across tabs.
    const candidate = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const transaction = this.store.legacy.transaction("kv", "readwrite");
    const winner = await transaction.store.get(WRAPPING_KEY);
    const key = winner instanceof CryptoKey ? winner : candidate;
    if (!(winner instanceof CryptoKey)) await transaction.store.put(key, WRAPPING_KEY);
    await transaction.done;
    return key;
  }
  async getItem(key: string): Promise<string | null> {
    const value = (await this.store.legacy.get("kv", entry(key))) as SealedValue | undefined;
    if (!value) return null;
    try {
      if (value.version !== 1) return null;
      return fromUtf8(new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy(value.iv), additionalData: utf8(key) }, await this.key(), copy(value.ciphertext))));
    } catch {
      await this.removeItem(key);
      return null;
    }
  }
  async setItem(key: string, value: string): Promise<void> {
    const iv = randomBytes(12);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: utf8(key) }, await this.key(), utf8(value)));
    await this.store.legacy.put("kv", { version: 1, iv, ciphertext } satisfies SealedValue, entry(key));
  }
  async removeItem(key: string): Promise<void> {
    await this.store.legacy.delete("kv", entry(key));
  }
}
export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
  projectRef: string;
}
/** Construct only after staged account migration is enabled. Existing production auth stays on its released path. */
export function createMeldiqSupabase(config: SupabasePublicConfig, store: LocalStore, options: { storageKey?: string; autoRefreshToken?: boolean } = {}): SupabaseClient {
  const url = new URL(config.url);
  if (url.protocol !== "https:" || url.hostname !== `${config.projectRef}.supabase.co` || url.pathname !== "/" || url.username || url.password || url.search || url.hash)
    throw new Error(uiText("auth.interface.invalid_supabase_project_origin_7e80ad1"));
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)) throw new Error(uiText("auth.interface.only_a_supabase_publishable_key_belongs_in_the_client_eb9a687"));
  return createClient(url.origin, config.publishableKey, {
    auth: {
      storage: new EncryptedSupabaseStorage(store),
      storageKey: options.storageKey ?? `meldiq-supabase:${config.projectRef}:${store.name}`,
      persistSession: true,
      autoRefreshToken: options.autoRefreshToken ?? true,
      flowType: "pkce",
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
        }),
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}
