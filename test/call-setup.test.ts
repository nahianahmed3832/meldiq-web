import { describe, expect, it } from "vitest";
import type { ApiClient } from "../src/api/client";
import { CallManager, type CallHost } from "../src/call/manager";
import { CallFailure } from "../src/call/rules";
import type { Payload } from "../src/protocol/payload";
import { Store } from "../src/state/store";
import { MediaRig } from "./support/fakeMedia";

/**
 * Call setup order (android round 7, bug 7): the caller's key message goes out while it connects to the media room, and
 * a failure to send it ends the call with the reason. The server here is a stand-in for its call API only.
 */
const call = (id: string) => ({ id, conversationId: "c1", createdBy: "me", video: false, state: "RINGING", createdAt: Date.now(), endedAt: null, endReason: null, conversationType: "DM" });

function setup(send: (p: Payload) => Promise<void>) {
  const rig = new MediaRig();
  const api = {
    json: async (method: string, path: string, schema: { parse(v: unknown): unknown }) => {
      if (method === "POST" && path === "/v1/calls") return schema.parse({ call: call("k1"), media: { url: "ws://lk", token: "t", room: "r1" }, joinedExisting: false });
      throw new Error(`unexpected ${method} ${path}`);
    },
    call: async () => new Response(null, { status: 204 }),
  } as unknown as ApiClient;
  const host: CallHost = {
    api,
    state: new Store(),
    me: { userId: "me", deviceId: "d1" },
    sendControlNow: (_c, p) => send(p),
    describe: async () => ({ title: "Bo", isGroup: false, colorIndex: 0, voiceRoom: false, canModerate: false }),
    displayName: () => null,
    recordCall: async () => undefined,
  };
  const calls = new CallManager(host, { media: rig.factory, supported: () => true, keyWaitMs: 500 });
  return { calls, rig, host };
}

describe("call setup order", () => {
  it("connects to the media room without waiting for the key message to be delivered", async () => {
    let release: () => void = () => undefined;
    const sent: Payload[] = [];
    const { calls, rig } = setup((p) => {
      sent.push(p);
      return new Promise<void>((r) => (release = r));
    });
    await calls.startCall("c1", false);
    // Connected with the key while its message is still on the way.
    expect(rig.last?.connected?.key).toBe(sent[0]?.e2eeKey);
    expect(sent[0]).toMatchObject({ type: "call_invite", callId: "k1" });
    release();
  });

  it("a key message that can't be sent ends the call with the reason", async () => {
    const { calls, host } = setup(async () => {
      throw new Error("network down");
    });
    await calls.startCall("c1", false);
    await new Promise((r) => setTimeout(r, 0));
    expect(host.state.get().call).toMatchObject({ phase: "ended", error: CallFailure.KEY_NOT_SENT });
  });
});
