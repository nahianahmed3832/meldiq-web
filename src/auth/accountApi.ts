import { ApiClient } from "../api/client";
import { canonical } from "../crypto/canonical";
import { sign } from "../crypto/ed25519";
import type { KeyBackup } from "../crypto/keyBackup";
import type { DeviceRecord } from "../model/types";
import { type AccountSessionGrant, zAccepted, zAccountMe, zAccountSession, zAccountView, zEnrollResult, zOk, zSelected, zSessionList, zVerified, zWorkspacesV2 } from "../api/accountSchemas";
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
const zRecoverStarted = z.object({ ticket: z.string(), email: z.string(), expiresAt: z.number() });
const zRecovered = z.object({ email: z.string(), remainingCodes: z.number() });
const zRecoveryStatus = z.object({ remaining: z.number(), total: z.number(), createdAt: z.number().nullable() });
const zRecoveryCodes = z.object({ codes: z.array(z.string()), createdAt: z.number() });
const zKeyBackupStatus = z.object({ exists: z.boolean(), updatedAt: z.number().nullable() });
const zKeyBackup = z.object({ version: z.number(), iterations: z.number(), salt: z.string(), nonce: z.string(), ciphertext: z.string(), identityKey: z.string() });
const zKeyUnlockStarted = z.object({ email: z.string(), expiresAt: z.number() });
export type RecoveryStatus = z.infer<typeof zRecoveryStatus>;
/** Options for the browser's passkey prompt (WebAuthn JSON), and this ceremony's id to send back with the answer. */
const zPasskeyOptions = z.object({ challengeId: z.string(), options: z.record(z.string(), z.unknown()) });
const zPasskey = z.object({ id: z.string(), name: z.string(), createdAt: z.number(), lastUsedAt: z.number().nullable(), synced: z.boolean() });
const zPasskeyList = z.object({ available: z.boolean(), passkeys: z.array(zPasskey) });
export type Passkey = z.infer<typeof zPasskey>;

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

  /** [totpCode]: the authenticator app's code or a backup code, when two-step sign-in is on (API 0.46.0). */
  login(email: string, password: string, deviceName: string, device?: DeviceProof, totpCode?: string): Promise<AccountSessionGrant> {
    return this.api.json("POST", "/v2/auth/login", zAccountSession, {
      auth: false,
      body: { email, password, deviceName, ...(device ? { device } : {}), ...(totpCode ? { totpCode } : {}) },
    });
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

  /**
   * Account recovery after losing the email address (server docs/ACCOUNT_RECOVERY.md): one recovery code, used up here,
   * and the new address, which gets a 6-digit code. Restores account access only, never encryption keys.
   */
  recoverStart(email: string, code: string, newEmail: string) {
    return this.api.json("POST", "/v2/auth/recover/start", zRecoverStarted, { auth: false, body: { email, code, newEmail } });
  }

  /** The emailed code and a new password: the account moves to the new address and every session signs out. */
  recoverComplete(ticket: string, code: string, newPassword: string) {
    return this.api.json("POST", "/v2/auth/recover/complete", zRecovered, { auth: false, body: { ticket, code, newPassword } });
  }

  /** Sign in with a passkey, step 1: options for [rpId] (this page's host) that offer any of the person's passkeys. */
  passkeyLoginOptions(rpId: string) {
    return this.api.json("POST", "/v2/auth/passkey/options", zPasskeyOptions, { auth: false, body: { rpId } });
  }

  /** Step 2: the browser's signed answer; the same session a password sign-in gives. */
  passkeyLogin(challengeId: string, response: Record<string, unknown>, deviceName: string): Promise<AccountSessionGrant> {
    return this.api.json("POST", "/v2/auth/passkey/login", zAccountSession, { auth: false, body: { challengeId, response, deviceName } });
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

  /**
   * Deletes the account for good (server docs/ACCOUNT_DELETION.md): the password again and the account's email typed by
   * the person. Refused with 409 owns_workspaces while they're a workspace's only owner; nothing changes then.
   */
  deleteAccount(password: string, confirmEmail: string) {
    return this.api.json("DELETE", "/v2/account", z.object({ deleted: z.literal(true), deletedAt: z.number() }), { body: { password, confirmEmail } });
  }

  /** How many of the account's recovery codes are left (never the codes). */
  recoveryCodesStatus() {
    return this.api.json("GET", "/v2/account/recovery-codes", zRecoveryStatus);
  }

  /** A new set of ten codes, shown once; replaces the old set. Needs the password again. */
  makeRecoveryCodes(password: string) {
    return this.api.json("POST", "/v2/account/recovery-codes", zRecoveryCodes, { body: { password } });
  }

  revokeRecoveryCodes(password: string): Promise<unknown> {
    return this.api.json("POST", "/v2/account/recovery-codes/revoke", zOk, { body: { password } });
  }

  /** Whether the account has a key backup for its current password and keys (server docs/KEY_BACKUP.md). */
  keyBackupStatus() {
    return this.api.json("GET", "/v2/account/key-backup", zKeyBackupStatus);
  }

  /** Saves the keys sealed under [password] (a device of the account only; the server checks the password). */
  saveKeyBackup(password: string, backup: KeyBackup) {
    return this.api.json("PUT", "/v2/account/key-backup", z.object({ updatedAt: z.number() }), { body: { password, backup } });
  }

  removeKeyBackup(): Promise<unknown> {
    return this.api.json("DELETE", "/v2/account/key-backup", zOk);
  }

  /** Emails a code for unlocking the backup in this session; says where it went (masked). */
  startKeyUnlock() {
    return this.api.json("POST", "/v2/account/key-backup/unlock/start", zKeyUnlockStarted, { body: {} });
  }

  /** The emailed code gets the sealed keys back (single use). */
  keyUnlock(code: string): Promise<KeyBackup> {
    return this.api.json("POST", "/v2/account/key-backup/unlock", zKeyBackup, { body: { code } });
  }

  /** The account's passkeys (made here and in the apps), and whether this server offers them. */
  passkeys() {
    return this.api.json("GET", "/v2/account/passkeys", zPasskeyList);
  }

  /** Add a passkey, step 1: create options for [rpId] that leave out the passkeys the account already has. */
  passkeyCreateOptions(rpId: string) {
    return this.api.json("POST", "/v2/account/passkeys/options", zPasskeyOptions, { body: { rpId } });
  }

  /** Step 2: the browser's new passkey, named [name] in the list. */
  addPasskey(challengeId: string, response: Record<string, unknown>, name: string) {
    return this.api.json("POST", "/v2/account/passkeys", z.object({ passkey: zPasskey }), { body: { challengeId, response, name } }).then((r) => r.passkey);
  }

  removePasskey(id: string): Promise<unknown> {
    return this.api.json("DELETE", `/v2/account/passkeys/${encodeURIComponent(id)}`, zOk);
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
export async function signInWithDevice(base: string, device: DeviceRecord, password: string, email?: string, totpCode?: string): Promise<AccountSessionGrant> {
  if (!device.account) throw new Error("This browser isn't signed in with a Meldiq account.");
  const accounts = AccountApi.anonymous(base);
  const nonce = await accounts.challenge();
  const signature = await sign(device.keys.signing.privateKey, canonical.authProof("login", nonce, device.keys.signingPublic));
  return accounts.login(email ?? device.account.email, password, device.deviceName, { deviceId: device.deviceId, nonce, signature }, totpCode);
}
