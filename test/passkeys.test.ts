import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountApi } from "../src/auth/accountApi";
import {
  addPasskey,
  createPasskey,
  creationOptions,
  fromBase64url,
  getPasskey,
  PasskeyCancelled,
  PasskeyError,
  passkeyRpId,
  requestOptions,
  signInWithPasskey,
  toBase64url,
} from "../src/auth/passkeys";
import { browserDeviceName, browserLabel } from "../src/sync/session";
import { passkeyDetails } from "../src/ui/settings/PasskeysCard";
import { authErrorText } from "../src/ui/auth/useSubmit";

/** Passkeys in the browser (src/auth/passkeys.ts, server docs/PASSKEYS.md): the JSON ↔ WebAuthn conversions and refusals. */

const bytes = (...b: number[]) => new Uint8Array(b).buffer;
const WEB = { passkeys: { webOrigins: ["https://web.meldiq.app"] } };

/** A browser credential as navigator.credentials returns it, enough for the JSON conversions. */
class FakeCredential {
  readonly type = "public-key";
  readonly authenticatorAttachment = "platform";
  constructor(
    readonly id: string,
    readonly response: Record<string, unknown>,
  ) {}
  get rawId() {
    return fromBase64url(this.id);
  }
  getClientExtensionResults() {
    return {};
  }
}

function browser(credentials: { create?: () => Promise<unknown>; get?: () => Promise<unknown> }) {
  vi.stubGlobal("PublicKeyCredential", FakeCredential);
  vi.stubGlobal("navigator", { credentials });
}

afterEach(() => vi.unstubAllGlobals());

describe("passkeys in the browser", () => {
  it("are offered only when the server lists this page's origin and the browser has WebAuthn", () => {
    expect(passkeyRpId(WEB, "https://web.meldiq.app", true)).toBe("web.meldiq.app");
    expect(passkeyRpId(WEB, "https://web.meldiq.app", false)).toBeNull();
    expect(passkeyRpId(WEB, "https://web.griipbuddy.cloud", true)).toBeNull();
    expect(passkeyRpId({ passkeys: null }, "https://web.meldiq.app", true)).toBeNull();
    // A server before API 0.30.0 says nothing about passkeys; one that's unreachable gives no info at all.
    expect(passkeyRpId({}, "https://web.meldiq.app", true)).toBeNull();
    expect(passkeyRpId(null, "https://web.meldiq.app", true)).toBeNull();
    expect(passkeyRpId({ passkeys: { webOrigins: ["http://localhost:5173"] } }, "http://localhost:5173", true)).toBe("localhost");
  });

  it("round-trip base64url without padding", () => {
    for (const b of [bytes(), bytes(0), bytes(0xfb, 0xff), bytes(1, 2, 3, 4, 5)]) {
      const text = toBase64url(b);
      expect(text).not.toMatch(/[+/=]/);
      expect(new Uint8Array(fromBase64url(text))).toEqual(new Uint8Array(b));
    }
    expect(toBase64url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
  });

  it("turn the server's create options into what navigator.credentials.create takes", () => {
    const o = creationOptions({
      rp: { name: "Meldiq", id: "web.meldiq.app" },
      user: { id: "AQID", name: "ada@example.com", displayName: "Ada" },
      challenge: "BAUG",
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      excludeCredentials: [{ id: "BwgJ", type: "public-key", transports: ["internal", "hybrid"] }],
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      attestation: "none",
    });
    expect(o.rp).toEqual({ name: "Meldiq", id: "web.meldiq.app" });
    expect(new Uint8Array(o.user.id as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(o.challenge as ArrayBuffer)).toEqual(new Uint8Array([4, 5, 6]));
    expect(o.excludeCredentials?.map((d) => [new Uint8Array(d.id as ArrayBuffer), d.transports])).toEqual([[new Uint8Array([7, 8, 9]), ["internal", "hybrid"]]]);
    expect(o.authenticatorSelection?.userVerification).toBe("required");
  });

  it("turn the server's sign-in options into what navigator.credentials.get takes", () => {
    const o = requestOptions({ rpId: "web.meldiq.app", challenge: "BAUG", allowCredentials: [], userVerification: "required", timeout: 300000 });
    expect(o).toMatchObject({ rpId: "web.meldiq.app", allowCredentials: [], userVerification: "required", timeout: 300000 });
    expect(new Uint8Array(o.challenge as ArrayBuffer)).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("send a new passkey and a signed answer back in the server's JSON form", async () => {
    browser({
      create: async () => new FakeCredential("AQID", { clientDataJSON: bytes(1), attestationObject: bytes(2), getTransports: () => ["internal"] }),
      get: async () => new FakeCredential("AQID", { clientDataJSON: bytes(1), authenticatorData: bytes(3), signature: bytes(4), userHandle: bytes(5) }),
    });
    const options = { challenge: "BAUG", user: { id: "AQID" }, rp: { id: "web.meldiq.app" } };
    expect(await createPasskey(options)).toEqual({
      id: "AQID",
      rawId: "AQID",
      type: "public-key",
      response: { clientDataJSON: "AQ", attestationObject: "Ag", transports: ["internal"] },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    });
    expect(await getPasskey({ challenge: "BAUG" })).toEqual({
      id: "AQID",
      rawId: "AQID",
      type: "public-key",
      response: { clientDataJSON: "AQ", authenticatorData: "Aw", signature: "BA", userHandle: "BQ" },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    });
  });

  it("treat a closed or timed-out prompt as cancelled, and explain the browser's other refusals", async () => {
    const refuse = (name: string) => async () => {
      throw new DOMException("no", name);
    };
    browser({ create: refuse("NotAllowedError"), get: refuse("NotAllowedError") });
    await expect(createPasskey({ challenge: "", user: { id: "" } })).rejects.toBeInstanceOf(PasskeyCancelled);
    await expect(getPasskey({ challenge: "" })).rejects.toBeInstanceOf(PasskeyCancelled);
    browser({ create: refuse("InvalidStateError"), get: refuse("SecurityError") });
    const exists = await createPasskey({ challenge: "", user: { id: "" } }).catch((e: unknown) => e);
    expect(exists).toBeInstanceOf(PasskeyError);
    expect(authErrorText(exists)).toMatch(/already has a passkey/);
    expect(authErrorText(await getPasskey({ challenge: "" }).catch((e: unknown) => e))).toMatch(/won't use passkeys on this address/);
    browser({ get: async () => null });
    await expect(getPasskey({ challenge: "" })).rejects.toBeInstanceOf(PasskeyCancelled);
  });

  it("ask the server for this page's relying party, and send the answer to the ceremony it started", async () => {
    browser({
      create: async () => new FakeCredential("AQID", { clientDataJSON: bytes(1), attestationObject: bytes(2) }),
      get: async () => new FakeCredential("AQID", { clientDataJSON: bytes(1), authenticatorData: bytes(3), signature: bytes(4) }),
    });
    const calls: unknown[][] = [];
    const accounts = {
      passkeyLoginOptions: async (rpId: string) => (calls.push(["loginOptions", rpId]), { challengeId: "c1", options: { challenge: "AQ" } }),
      passkeyLogin: async (challengeId: string, response: { id: string }, deviceName: string) => (calls.push(["login", challengeId, response.id, deviceName]), { grant: true }),
      passkeyCreateOptions: async (rpId: string) => (calls.push(["createOptions", rpId]), { challengeId: "c2", options: { challenge: "AQ", user: { id: "AQ" } } }),
      addPasskey: async (challengeId: string, response: { id: string }, name: string) => (calls.push(["add", challengeId, response.id, name]), { id: "AQID" }),
    } as unknown as AccountApi;
    expect(await signInWithPasskey(accounts, "web.meldiq.app", "Meldiq Web · Chrome on macOS")).toEqual({ grant: true });
    expect(await addPasskey(accounts, "web.meldiq.app", "Chrome on macOS")).toEqual({ id: "AQID" });
    expect(calls).toEqual([
      ["loginOptions", "web.meldiq.app"],
      ["login", "c1", "AQID", "Meldiq Web · Chrome on macOS"],
      ["createOptions", "web.meldiq.app"],
      ["add", "c2", "AQID", "Chrome on macOS"],
    ]);
  });

  it("are named after the browser and described by when they were added and used", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
    expect(browserLabel(mac)).toBe("Chrome on macOS");
    expect(browserDeviceName(mac)).toBe("Meldiq Web · Chrome on macOS");
    const now = new Date(2026, 9, 23, 12).getTime();
    const p = { id: "x", name: "Pixel", createdAt: now - 60_000, lastUsedAt: null, synced: true };
    expect(passkeyDetails(p, now)).toMatch(/^Added .+ · never used · synced$/);
    expect(passkeyDetails({ ...p, lastUsedAt: now - 60_000, synced: false }, now)).toMatch(/^Added .+ · used .+$/);
    expect(passkeyDetails({ ...p, synced: false }, now)).not.toMatch(/synced/);
  });
});
