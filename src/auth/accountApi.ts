import { ApiClient } from "../api/client";
import { canonical } from "../crypto/canonical";
import { sign } from "../crypto/ed25519";
import type { DeviceRecord } from "../model/types";
import {
  type AccountSessionGrant,
  zAccepted,
  zAccountMe,
  zAccountSession,
  zAccountView,
  zEnrollResult,
  zLegacyTicket,
  zOk,
  zSelected,
  zSessionList,
  zVerified,
  zWorkspacesV2,
} from "../api/accountSchemas";
import { z } from "zod";

/** Proof that this browser holds an existing device key: a fresh challenge signed with it (griip-auth-v1 "login"). */
export interface DeviceProof {
  deviceId: string;
  nonce: string;
  signature: string;
}

/** A new device's public keys and the identity's certificate for them. */
export interface NewDevice {
  name: string;
  signingKey: string;
  encryptionKey: string;
  certificate: string;
}

const zChallenge = z.object({ nonce: z.string() });

/**
 * The Orbit 2.0 account routes (docs/ORBIT_2_ARCHITECTURE §6). Calls before sign-in go without a token; the rest use the
 * [ApiClient]'s credentials (the account session).
 */
export class AccountApi {
  constructor(readonly api: ApiClient) {}

  static anonymous(base: string): AccountApi {
    return new AccountApi(new ApiClient(base));
  }

  challenge(): Promise<string> {
    return this.api.json("POST", "/v1/auth/challenge", zChallenge, { auth: false, body: {} }).then((r) => r.nonce);
  }

  register(name: string, email: string, password: string, inviteCode?: string): Promise<unknown> {
    return this.api.json("POST", "/v2/auth/register", zAccepted, { auth: false, body: { name, email, password, ...(inviteCode ? { inviteCode } : {}) } });
  }

  verifyEmail(email: string, code: string, password: string): Promise<unknown> {
    return this.api.json("POST", "/v2/auth/email/verify", zVerified, { auth: false, body: { email, code, password } });
  }

  resendVerification(email: string): Promise<unknown> {
    return this.api.json("POST", "/v2/auth/email/resend", zAccepted, { auth: false, body: { email } });
  }

  login(email: string, password: string, deviceName: string, device?: DeviceProof): Promise<AccountSessionGrant> {
    return this.api.json("POST", "/v2/auth/login", zAccountSession, { auth: false, body: { email, password, deviceName, ...(device ? { device } : {}) } });
  }

  refresh(refreshToken: string): Promise<AccountSessionGrant> {
    return this.api.json("POST", "/v2/auth/refresh", zAccountSession, { auth: false, body: { refreshToken } });
  }

  forgotPassword(email: string): Promise<unknown> {
    return this.api.json("POST", "/v2/auth/password/forgot", zAccepted, { auth: false, body: { email } });
  }

  resetPassword(email: string, code: string, newPassword: string): Promise<unknown> {
    return this.api.json("POST", "/v2/auth/password/reset", zOk, { auth: false, body: { email, code, newPassword } });
  }

  legacyVerify(username: string, nonce: string, signature: string) {
    return this.api.json("POST", "/v2/migration/legacy/verify", zLegacyTicket, { auth: false, body: { username, nonce, signature } });
  }

  legacyComplete(ticket: string, name: string, email: string, password: string): Promise<unknown> {
    return this.api.json("POST", "/v2/migration/legacy/complete", zAccepted, { auth: false, body: { ticket, name, email, password } });
  }

  // ───────────── signed in ─────────────

  logout(): Promise<void> {
    return this.api.call("POST", "/v2/auth/logout", { body: {} });
  }

  me() {
    return this.api.json("GET", "/v2/account", zAccountMe);
  }

  rename(name: string) {
    return this.api.json("PATCH", "/v2/account", z.object({ account: zAccountView }), { body: { name } }).then((r) => r.account);
  }

  changePassword(currentPassword: string, newPassword: string): Promise<unknown> {
    return this.api.json("POST", "/v2/account/password", zOk, { body: { currentPassword, newPassword } });
  }

  sessions() {
    return this.api.json("GET", "/v2/account/sessions", zSessionList).then((r) => r.sessions);
  }

  endSession(id: string): Promise<void> {
    return this.api.call("DELETE", `/v2/account/sessions/${encodeURIComponent(id)}`);
  }

  selectWorkspace(selectedWorkspaceId: string) {
    return this.api.json("PUT", "/v2/account/preferences", zSelected, { body: { selectedWorkspaceId } });
  }

  workspaces() {
    return this.api.json("GET", "/v2/workspaces", zWorkspacesV2);
  }

  /** Sets up this browser as a device of the account: with [identityKey] when it creates the account's identity. */
  enroll(body: { identityKey?: string; username?: string; device: NewDevice; nonce: string; signature: string }) {
    return this.api.json("POST", "/v2/account/devices", zEnrollResult, { body });
  }
}

/**
 * Signs in again after the account session ended: the password, plus proof that this browser still holds its device key
 * (a fresh challenge signed with it), so the new session is bound to this device. A removed device is refused
 * (device_revoked).
 */
export async function signInWithDevice(base: string, device: DeviceRecord, password: string): Promise<AccountSessionGrant> {
  if (!device.account) throw new Error("This browser isn't signed in with an Orbit account.");
  const accounts = AccountApi.anonymous(base);
  const nonce = await accounts.challenge();
  const signature = await sign(device.keys.signing.privateKey, canonical.authProof("login", nonce, device.keys.signingPublic));
  return accounts.login(device.account.email, password, device.deviceName, { deviceId: device.deviceId, nonce, signature });
}
