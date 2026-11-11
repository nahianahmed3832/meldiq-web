import { copy, fromB64, fromUtf8, toB64, utf8 } from "../crypto/bytes";
import type { LocalStore } from "./db";

const browserStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/** Each tab retains its own drafts on reload. Only ciphertext enters sessionStorage; the key stays in account IndexedDB. */
export class TabDrafts {
  private drafts: Record<string, string> = {};
  private loaded: Promise<Record<string, string>> | null = null;
  private writing = Promise.resolve();
  private generation = 0;
  private readonly storageKey: string;
  private readonly aad: Uint8Array<ArrayBuffer>;
  constructor(
    private readonly store: LocalStore,
    userId: string,
    deviceId: string,
    private readonly storage = browserStorage(),
  ) {
    this.storageKey = `meldiq.tab-drafts:${store.name}`;
    this.aad = utf8(JSON.stringify([this.storageKey, userId, deviceId, 1]));
  }

  load(): Promise<Record<string, string>> {
    return (this.loaded ??= this.restore());
  }
  private async restore(): Promise<Record<string, string>> {
    const generation = this.generation;
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return this.drafts;
      const sealed = JSON.parse(raw) as { iv: string; data: string };
      const key = await this.store.localEncryptionKey("snapshotKey");
      const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: copy(fromB64(sealed.iv)), additionalData: this.aad }, key, copy(fromB64(sealed.data)));
      const value: unknown = JSON.parse(fromUtf8(new Uint8Array(bytes)));
      if (generation === this.generation && value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((text) => typeof text === "string"))
        this.drafts = value as Record<string, string>;
    } catch {
      if (generation === this.generation) {
        this.drafts = {};
        try {
          this.storage?.removeItem(this.storageKey);
        } catch {
          /* storage unavailable */
        }
      }
    }
    return this.drafts;
  }
  save(conversationId: string, text: string): Promise<void> {
    const generation = this.generation;
    const save = async () => {
      if (generation !== this.generation) return;
      if (!this.storage) {
        if (typeof window === "undefined") return;
        throw new DOMException("", "SecurityError");
      }
      await this.load();
      if (generation !== this.generation) return;
      this.drafts[conversationId] = text;
      const key = await this.store.localEncryptionKey("snapshotKey");
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: this.aad }, key, utf8(JSON.stringify(this.drafts)));
      if (generation === this.generation) this.storage.setItem(this.storageKey, JSON.stringify({ iv: toB64(iv), data: toB64(new Uint8Array(data)) }));
    };
    const next = this.writing.then(save, save);
    this.writing = next.catch(() => undefined);
    return next;
  }
  clear(): void {
    this.generation++;
    this.drafts = {};
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      /* storage unavailable */
    }
  }
}
