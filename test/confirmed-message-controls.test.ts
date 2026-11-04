import "fake-indexeddb/auto";
import { expect, it, vi } from "vitest";
import { Compose, type ComposeHost } from "../src/sync/compose";
import { LocalStore } from "../src/store/db";
import { initialState } from "../src/state/store";
import type { StoredMessage, DeviceRecord } from "../src/model/types";
import type { Conversation } from "../src/api/schemas";
it("failed edit, delete and pin preserve the original, retries use the supplied ID, and late edit acknowledgements preserve newer data", async () => {
  const store = await LocalStore.open(`confirmed-controls-${Math.random()}`);
  try {
    const m = {
      id: "m_control",
      conversationId: "c_control",
      text: "Original",
      outgoing: true,
      deleted: false,
      editedAt: null,
      attachments: [],
      rich: null,
      reactions: {},
      mentions: [],
    } as unknown as StoredMessage;
    await store.putMessage(m);
    const confirm = vi.fn<ComposeHost["confirmControl"]>().mockRejectedValue(new Error("Fixture refusal"));
    const host: ComposeHost = {
      store,
      device: { userId: "u_me" } as DeviceRecord,
      state: () => ({ ...initialState, conversations: { c_control: { id: "c_control", type: "DM", orgId: null, canPost: true } as Conversation } }),
      membersOf: async () => [],
      show: () => undefined,
      bump: async () => undefined,
      refreshPreview: async () => undefined,
      queue: async () => {
        throw Error("Controls must be confirmed");
      },
      confirmControl: confirm,
    };
    const compose = new Compose(host);
    await expect(compose.edit(m, "Draft", "edit_same_id")).rejects.toThrow("Fixture refusal");
    await expect(compose.deleteForEveryone(m, false, "delete_same_id")).rejects.toThrow("Fixture refusal");
    await expect(compose.setPinned(m, true)).rejects.toThrow("Fixture refusal");
    expect(await store.message(m.id)).toMatchObject({ text: "Original", deleted: false, editedAt: null });
    confirm.mockResolvedValue(10);
    await compose.edit(m, "Draft", "edit_same_id");
    expect(confirm.mock.calls.filter((call) => call[1].type === "edit").map((call) => call[2])).toEqual(["edit_same_id", "edit_same_id"]);
    expect(await store.message(m.id)).toMatchObject({ text: "Draft", editedAt: 10 });
    await store.putMessage({ ...m, text: "Newer edit", editedAt: 20, reactions: { "👍": ["u_other"] } });
    await compose.edit(m, "Older acknowledgement", "older_edit");
    expect(await store.message(m.id)).toMatchObject({ text: "Newer edit", editedAt: 20, reactions: { "👍": ["u_other"] } });
    await compose.setPinned(m, true);
    expect((await store.message(m.id))?.pinned).toBe(true);
    await compose.setPinned(m, false);
    expect((await store.message(m.id))?.pinned).toBe(false);
    await compose.deleteForEveryone(m, false, "delete_same_id");
    expect(await store.message(m.id)).toMatchObject({ text: "", deleted: true, attachments: [] });
  } finally {
    await LocalStore.erase(store);
  }
});
