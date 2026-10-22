import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import type { EngineContext } from "../src/sync/context";
import { Receiver } from "../src/sync/receiver";
import { UNSUPPORTED_TEXT } from "../src/sync/rules";

/** Queue items this version can't parse (a newer kind or payload) keep a placeholder before they're acknowledged. */
function receiver(fail = false) {
  const stored: StoredMessage[] = [];
  const ctx = {
    store: {
      insertMessageIfAbsent: async (m: StoredMessage) => {
        if (fail) throw new Error("store unavailable");
        stored.push(m);
        return true;
      },
    },
    show: () => undefined,
    bump: async () => undefined,
    viewing: () => null,
  } as unknown as EngineContext;
  return { r: new Receiver(ctx), stored };
}

const newer = {
  id: 7,
  kind: "story",
  conversationId: "c_1",
  messageId: "m_story_1",
  senderUserId: "u_bob",
  senderDeviceId: "d_bob",
  createdAt: 1_700_000_000_000,
  expiresAt: 0,
  payload: { cls: "message" },
};

describe("queue items the web can't parse", () => {
  it("an unknown item kind becomes a placeholder in its conversation, then is acknowledged", async () => {
    const { r, stored } = receiver();
    expect(await r.process([newer])).toEqual([7]);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: "m_story_1", conversationId: "c_1", senderUserId: "u_bob", kind: "undecryptable", text: UNSUPPORTED_TEXT, errorText: "queue item kind story" });
  });

  it("isn't acknowledged while its placeholder can't be stored, so the server delivers it again", async () => {
    const { r } = receiver(true);
    expect(await r.process([newer])).toEqual([]);
  });

  it("a malformed receipt or control, or an item that names no message, is acknowledged without a placeholder", async () => {
    const { r, stored } = receiver();
    const receipt = { ...newer, id: 8, kind: "receipt", payload: { status: 5 } };
    const control = { ...newer, id: 9, payload: { cls: "control" } };
    const anonymous = { id: 10, kind: "story" };
    expect(await r.process([receipt, control, anonymous, { nothing: true }])).toEqual([8, 9, 10]);
    expect(stored).toEqual([]);
  });
});
