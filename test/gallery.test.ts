import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/model/types";
import type { AttachmentRef } from "../src/protocol/payload";
import { galleryOf } from "../src/ui/chat/gallery";

const ref = (id: string, mime: string, extra: Partial<AttachmentRef> = {}): AttachmentRef => ({ id, name: `${id}.bin`, mime, size: 10, key: "k", nonce: "n", sha256: "s", ...extra });

function message(id: string, sortTs: number, attachments: AttachmentRef[], extra: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id,
    conversationId: "c1",
    senderUserId: "u1",
    senderDeviceId: "d1",
    outgoing: false,
    kind: "text",
    text: "",
    replyToId: null,
    threadRootId: null,
    mentions: [],
    mentionAll: false,
    attachments,
    sentAt: sortTs,
    serverTs: sortTs,
    sortTs,
    status: "DELIVERED",
    errorText: null,
    editedAt: null,
    deleted: false,
    pinned: false,
    reactions: {},
    readBy: [],
    deliveredTo: [],
    call: null,
    rich: null,
    forwarded: false,
    ...extra,
  };
}

describe("conversation gallery", () => {
  it("puts photos and videos in the media grid and documents in files, newest first", () => {
    const g = galleryOf([
      message("m1", 1, [ref("a", "image/png"), ref("b", "application/pdf")]),
      message("m2", 2, [ref("c", "video/mp4")]),
      message("m3", 3, [ref("d", "image/jpeg"), ref("e", "text/plain")]),
    ]);
    expect(g.media.map((i) => i.ref.id)).toEqual(["d", "c", "a"]);
    expect(g.files.map((i) => i.ref.id)).toEqual(["e", "b"]);
    expect(g.media[0]).toMatchObject({ messageId: "m3", at: 3 });
  });

  it("leaves out deleted messages, voice messages and repeats of the same attachment", () => {
    const g = galleryOf([
      message("m1", 1, [ref("a", "image/png")]),
      message("m2", 2, [ref("v", "audio/mp4", { voice: true, durationMs: 1000 })]),
      message("m3", 3, [ref("x", "image/png")], { deleted: true }),
      message("m4", 4, [ref("a", "image/png")]),
    ]);
    expect(g.media.map((i) => i.ref.id)).toEqual(["a"]);
    expect(g.media[0].messageId).toBe("m4");
    expect(g.files).toEqual([]);
  });

  it("treats an image type the browser won't show inline (SVG) as a file to download", () => {
    const g = galleryOf([message("m1", 1, [ref("s", "image/svg+xml")])]);
    expect(g.media).toEqual([]);
    expect(g.files.map((i) => i.ref.id)).toEqual(["s"]);
  });
});
