import { z } from "zod";
import { ApiError } from "../api/client";
import { type Activity, type Conversation, type Device, type Member, type OrgDetail, zActivity, zConversation, zDevice, zMember, zOrgDetail, zProfile } from "../api/schemas";
import { LocalStore } from "../store/db";
import type { Engine } from "./engine";

/** Account, people and workspace actions: thin wrappers over existing server routes (server/src/routes). */

const zSearch = z.object({ users: z.array(zMember) });

export async function searchPeople(engine: Engine, q: string): Promise<Member[]> {
  const term = q.trim();
  if (!term) return [];
  return (await engine.api.json("GET", `/v1/users/search?q=${encodeURIComponent(term.slice(0, 40))}`, zSearch)).users;
}

/** Opens (or creates) the direct conversation with [userId] and returns its id. */
/** Someone on another server by their exact address (@name:domain), found through federation (exact match only). */
export async function resolveAddress(engine: Engine, address: string): Promise<Member> {
  const r = await engine.api.json("GET", `/v1/federation/resolve?address=${encodeURIComponent(address.trim())}`, z.object({ user: zMember }));
  return r.user;
}

export async function startDirect(engine: Engine, userId: string): Promise<string> {
  const { conversation } = await engine.api.json("POST", "/v1/conversations/dm", z.object({ conversation: zConversation }), { body: { userId } });
  await engine.ensureConversation(conversation.id);
  return conversation.id;
}

export async function browseChannels(engine: Engine, orgId: string): Promise<Conversation[]> {
  return (await engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/channels`, z.object({ channels: z.array(zConversation) }))).channels;
}

export async function joinChannel(engine: Engine, conversationId: string): Promise<void> {
  await engine.api.json("POST", `/v1/conversations/${encodeURIComponent(conversationId)}/join`, z.object({ conversation: zConversation }));
  await engine.refreshAll();
}

export async function orgDetail(engine: Engine, orgId: string): Promise<OrgDetail> {
  return engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}`, zOrgDetail);
}

export async function orgActivity(engine: Engine, orgId: string): Promise<Activity[]> {
  return (await engine.api.json("GET", `/v1/orgs/${encodeURIComponent(orgId)}/activity`, z.object({ activity: z.array(zActivity) }))).activity;
}

export async function conversationMembers(engine: Engine, conversationId: string): Promise<Member[]> {
  return (await engine.api.json("GET", `/v1/conversations/${encodeURIComponent(conversationId)}/members`, z.object({ members: z.array(zMember) }))).members;
}

/** Your address on the Meldiq network (`@name:server`), when this server federates; null when it doesn't. */
export async function networkAddress(engine: Engine): Promise<string | null> {
  if (!engine.state.get().server?.federation) return null;
  return (await engine.api.json("GET", "/v1/federation/info", z.object({ address: z.string().max(300) }))).address;
}

export async function userProfile(engine: Engine, userId: string) {
  return (await engine.api.json("GET", `/v1/users/${encodeURIComponent(userId)}`, z.object({ user: zProfile }))).user;
}

export async function updateProfile(engine: Engine, change: { displayName?: string; statusText?: string | null }): Promise<void> {
  await engine.api.call("PATCH", "/v1/users/me", { body: change });
  await engine.refreshAll();
}

export async function listDevices(engine: Engine): Promise<Device[]> {
  return (await engine.api.json("GET", "/v1/devices", z.object({ devices: z.array(zDevice) }))).devices;
}

export async function revokeDevice(engine: Engine, deviceId: string): Promise<void> {
  await engine.api.call("DELETE", `/v1/devices/${encodeURIComponent(deviceId)}`);
}

export class SignOutUnconfirmed extends Error {}

/**
 * Removes this browser from the account first (so contacts stop encrypting to it and its queue is deleted), then erases
 * its keys and data (android "Sign out & erase", T1.9). If the server can't confirm, nothing is erased unless [force].
 */
export async function signOut(engine: Engine, force = false): Promise<void> {
  engine.setSigningOut(true);
  try {
    await revokeDevice(engine, engine.device.deviceId);
  } catch (e) {
    const gone = e instanceof ApiError && (e.status === 401 || e.status === 404);
    if (!gone && !force) {
      engine.setSigningOut(false);
      throw new SignOutUnconfirmed(e instanceof ApiError ? e.message : "Couldn't reach the server");
    }
  }
  engine.stop();
  engine.session.forget();
  await LocalStore.erase(engine.store);
}
