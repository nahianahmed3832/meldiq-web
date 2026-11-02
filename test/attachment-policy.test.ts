import { describe, expect, it } from "vitest";
import { attachmentName, detectedMime, inspectFile, riskyAttachment } from "../src/sync/attachmentPolicy";
import { zAttachmentRef } from "../src/protocol/payload";

const head = (text: string) => new TextEncoder().encode(text);
describe("attachment plaintext policy", () => {
  it("uses signatures instead of image or video labels, and keeps arbitrary files downloadable", async () => {
    expect(detectedMime(head("<svg onload=alert(1)>"), "image/svg+xml")).toBe("application/octet-stream");
    expect(detectedMime(head("MZprogram"), "image/jpeg")).toBe("application/octet-stream");
    expect(detectedMime(head("%PDF-1.7"), "image/jpeg")).toBe("application/pdf");
    expect(detectedMime(head("\0\0\0\x18ftypavif"), "application/octet-stream")).toBe("image/avif");
    const file = await inspectFile(new File(["%PDF-1.7"], "../invoice\u202e.jpg", { type: "image/jpeg" }));
    expect([file.name, file.type]).toEqual(["invoice.jpg", "application/pdf"]);
    expect(await file.text()).toBe("%PDF-1.7");
  });
  it("removes path and display spoofing characters, preserves extensions and flags executable downloads", () => {
    expect(attachmentName("folder\\..\\report\u202e.exe")).toBe("report.exe");
    expect(attachmentName("a".repeat(300) + ".docx")).toHaveLength(120);
    expect(attachmentName("../...")).toBe("file");
    expect(riskyAttachment("photo.jpg.exe")).toBe(true);
    expect(riskyAttachment("report.docx")).toBe(false);
  });
  it("accepts legacy references and bounds separate previews without recursion", () => {
    const ref = { id: "a", name: "original", mime: "image/png", size: 100, key: "key", nonce: "nonce", sha256: "hash" };
    expect(zAttachmentRef.parse(ref)).toEqual(ref);
    const thumbnail = { ...ref, id: "preview", size: 100 };
    expect(zAttachmentRef.parse({ ...ref, thumbnail }).thumbnail?.id).toBe("preview");
    expect(zAttachmentRef.parse({ ...ref, thumbnail: { ...thumbnail, size: 131073 } }).thumbnail).toBeUndefined();
    expect(zAttachmentRef.parse({ ...ref, thumbnail: { ...thumbnail, mime: "image/svg+xml" } }).thumbnail).toBeUndefined();
  });
});
