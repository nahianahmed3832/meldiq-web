import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { Compose, type ComposeHost } from "../src/sync/compose";
import { LocalStore } from "../src/store/db";
import { initialState } from "../src/state/store";
import type { DeviceRecord, StoredMessage } from "../src/model/types";
import type { Conversation } from "../src/api/schemas";

it("preserves concurrent emoji reactions and removes only the selected emoji", async () => {
  const store = await LocalStore.open(`multiple-reactions-${Math.random()}`);
  try {
    const message = { id: "m_test", conversationId: "c_test", text: "hello", reactions: {}, attachments: [], outgoing: false } as unknown as StoredMessage;
    await store.putMessage(message);
    const controls: Record<string, unknown>[] = [];
    const host: ComposeHost = {
      store,
      device: { userId: "u_me" } as DeviceRecord,
      state: () => ({ ...initialState, conversations: { c_test: { id: "c_test", type: "DM", orgId: null, canPost: true } as Conversation } }),
      membersOf: async () => [],
      show: () => undefined,
      bump: async () => undefined,
      refreshPreview: async () => undefined,
      confirmControl: async () => 0,
      queue: async (item) => {
        controls.push(JSON.parse(item.payloadJson));
      },
    };
    const compose = new Compose(host);
    await Promise.all(["👍", "❤️", "🎉"].map((emoji) => compose.react(message, emoji)));
    expect((await store.message(message.id))?.reactions).toEqual({ "👍": ["u_me"], "❤️": ["u_me"], "🎉": ["u_me"] });
    await compose.react(message, "❤️");
    expect((await store.message(message.id))?.reactions).toEqual({ "👍": ["u_me"], "🎉": ["u_me"] });
    expect(controls.map((item) => [item.emoji, item.add])).toEqual([
      ["👍", true],
      ["❤️", true],
      ["🎉", true],
      ["❤️", false],
    ]);
  } finally {
    await LocalStore.erase(store);
  }
});
