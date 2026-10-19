import { ApiClient, ApiError, type Credentials } from "../api/client";
import { type SessionGrant, zPairingPoll, zPairingStart, zSession } from "../api/schemas";
import { canonical } from "../crypto/canonical";
import { seedMatchesPublicKey, sign, verify } from "../crypto/ed25519";
import { deriveHistoryKeys } from "../crypto/history";
import { type DeviceKeys, generateDeviceKeys, generateTransferKeys, openSealedSeed, type TransferKeys } from "../crypto/identity";
import type { DeviceRecord } from "../model/types";
import { z } from "zod";

const zChallenge = z.object({ nonce: z.string() });

async function challenge(api: ApiClient): Promise<string> {
  return (await api.json("POST", "/v1/auth/challenge", zChallenge, { auth: false, body: {} })).nonce;
}

/** Why this browser can't sign in any more. */
export type RevokedReason = "device_revoked" | "account_disabled" | "unknown_device";

/**
 * The session token, held in memory only: never written to storage. Each page load, and each time the server refuses the
 * token, this browser signs a fresh challenge with its non-extractable device key (android SessionRepository.reauth).
 */
export class SessionManager implements Credentials {
  private current: string | null = null;
  private inflight: Promise<boolean> | null = null;
  private readonly setup: ApiClient;

  constructor(
    base: string,
    readonly device: DeviceRecord,
    private readonly onRevoked: (reason: RevokedReason) => void,
  ) {
    this.setup = new ApiClient(base);
  }

  token(): string | null {
    return this.current;
  }

  /** Adopts the token of a session the server just granted (linking). */
  adopt(grant: SessionGrant): void {
    this.current = grant.sessionToken;
  }

  forget(): void {
    this.current = null;
  }

  reauthenticate(): Promise<boolean> {
    this.inflight ??= this.login().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async login(): Promise<boolean> {
    try {
      const nonce = await challenge(this.setup);
      const signature = await sign(this.device.keys.signing.privateKey, canonical.authProof("login", nonce, this.device.keys.signingPublic));
      const grant = await this.setup.json("POST", "/v1/auth/login", zSession, { auth: false, body: { deviceId: this.device.deviceId, nonce, signature } });
      this.current = grant.sessionToken;
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        this.current = null;
        // "Invalid device proof" also covers a server that no longer has this device at all.
        this.onRevoked(e.code === "device_revoked" || e.code === "account_disabled" ? e.code : "unknown_device");
      }
      return false;
    }
  }
}

/** A link request this browser is waiting on: the phone approves its code in Settings › Devices. */
export interface PendingLink {
  pairingId: string;
  code: string;
  expiresAt: number;
  deviceName: string;
  keys: DeviceKeys;
  transfer: TransferKeys;
}

export async function startLink(base: string, deviceName: string): Promise<PendingLink> {
  const api = new ApiClient(base);
  const keys = await generateDeviceKeys();
  const transfer = await generateTransferKeys();
  const r = await api.json("POST", "/v1/pairing", zPairingStart, {
    auth: false,
    body: { deviceName, signingKey: keys.signingPublic, encryptionKey: keys.encryptionPublic, transferKey: transfer.publicKey },
  });
  return { pairingId: r.pairingId, code: r.code, expiresAt: r.expiresAt, deviceName, keys, transfer };
}

export type LinkPoll = { status: "pending" } | { status: "expired" } | { status: "linked"; device: DeviceRecord; grant: SessionGrant };

export class LinkError extends Error {}

/** The phone's approval, opened and checked: the account's identity seed (the caller wipes it) and its public key. */
export type LinkApproval = { status: "pending" } | { status: "expired" } | { status: "approved"; seed: Uint8Array; identityKey: string; username: string; certificate: string };

/**
 * Checks the request once. When the phone has approved it: opens the identity seed and checks it belongs to the identity
 * key the phone named and that the certificate binds this browser's keys.
 */
export async function pollLinkApproval(base: string, link: PendingLink): Promise<LinkApproval> {
  const api = new ApiClient(base);
  const r = await api.json("GET", `/v1/pairing/${encodeURIComponent(link.pairingId)}`, zPairingPoll, { auth: false });
  if (r.status !== "approved") return r;
  const seed = await openSealedSeed(link.transfer.pair, r.sealedEnc, r.sealedIdentity, link.keys.signingPublic).catch(() => {
    throw new LinkError("The approval couldn't be opened. Start again.");
  });
  try {
    if (!(await seedMatchesPublicKey(seed, r.identityKey))) throw new LinkError("The account's identity didn't match. Linking was stopped.");
    const cert = canonical.deviceCert(r.identityKey, link.keys.signingPublic, link.keys.encryptionPublic);
    if (!(await verify(r.identityKey, cert, r.certificate))) throw new LinkError("The approval wasn't signed for this browser. Linking was stopped.");
  } catch (e) {
    seed.fill(0);
    throw e;
  }
  return { status: "approved", seed, identityKey: r.identityKey, username: r.username, certificate: r.certificate };
}

/**
 * Linking without an Orbit 2.0 account (v1): once the phone approved, registers this browser as a device of the phone's
 * account, derives the history keys and drops the seed.
 */
export async function pollLink(base: string, link: PendingLink): Promise<LinkPoll> {
  const r = await pollLinkApproval(base, link);
  if (r.status !== "approved") return r;
  const api = new ApiClient(base);
  try {
    const nonce = await challenge(api);
    const grant = await api.json("POST", "/v1/auth/add-device", zSession, {
      auth: false,
      body: {
        username: r.username,
        device: { name: link.deviceName, signingKey: link.keys.signingPublic, encryptionKey: link.keys.encryptionPublic, certificate: r.certificate },
        nonce,
        signature: await sign(link.keys.signing.privateKey, canonical.authProof("add-device", nonce, link.keys.signingPublic)),
      },
    });
    const history = await deriveHistoryKeys(r.seed, grant.userId);
    const device: DeviceRecord = {
      userId: grant.userId,
      deviceId: grant.deviceId,
      username: r.username,
      identityKey: r.identityKey,
      keys: link.keys,
      history,
      linkedAt: Date.now(),
      deviceName: link.deviceName,
    };
    return { status: "linked", device, grant };
  } finally {
    r.seed.fill(0);
  }
}

/** "Chrome on macOS": how this browser appears in the account's device list. */
export function browserDeviceName(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "the web";
  return `Meldiq Web · ${browser} on ${os}`;
}
