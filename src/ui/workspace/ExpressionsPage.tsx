import { Pencil, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { EXPRESSION_MAX_BYTES, EXPRESSION_NAME, type Expression, expressions, removeExpression, renameExpression, SHRINK_TO, suggestName, uploadExpression } from "../../sync/expressions";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { Dialog } from "../components/Overlay";
import { shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

const KEPT = ["image/png", "image/gif", "image/webp"];

/** PNG, GIF and WebP up to 256 KB are kept as they are; other pictures are shrunk to a PNG (android ExpressionsScreen). */
async function prepare(file: File, kind: "emoji" | "sticker"): Promise<Uint8Array> {
  if (KEPT.includes(file.type) && file.size <= EXPRESSION_MAX_BYTES) return new Uint8Array(await file.arrayBuffer());
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That picture couldn't be read.");
  });
  const side = SHRINK_TO[kind];
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("This browser can't resize pictures.");
  if (blob.size > EXPRESSION_MAX_BYTES) throw new Error("That picture is too large even after shrinking it.");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Emoji & stickers (batch B9, android ExpressionsScreen): Emoji · n/50 and Stickers · n/20, each with Upload (a picture
 * named `:like_this:`), rename and remove. For people who can manage emoji and stickers; every member can use them.
 */
export function ExpressionsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const [rev, setRev] = useState(0);
  const list = useLoad(() => expressions(engine, orgId, true), [engine, orgId, rev]);
  const canManage = detail.permissions.isOwner || detail.permissions.effective.includes("expressions.manage");
  const [uploading, setUploading] = useState<{ kind: "emoji" | "sticker"; file: File } | null>(null);
  const [renaming, setRenaming] = useState<Expression | null>(null);
  const act = useAction();
  const file = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"emoji" | "sticker">("emoji");
  const group = (k: "emoji" | "sticker") => {
    const items = (list.data?.expressions ?? []).filter((e) => e.kind === k);
    const limit = list.data?.limits[k] ?? (k === "emoji" ? 50 : 20);
    return (
      <Card
        title={`${k === "emoji" ? "Emoji" : "Stickers"} · ${items.length}/${limit}`}
        sub={k === "emoji" ? "Members use them in this community's channels, in messages and as reactions." : "Sent on their own, shown large."}
        actions={
          canManage && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={items.length >= limit}
              onClick={() => {
                setKind(k);
                file.current?.click();
              }}
            >
              <Upload size={14} /> Upload
            </button>
          )
        }
      >
        <ul className="ws-list">
          {items.map((e) => (
            <li key={e.id} className="ws-row">
              <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={k === "emoji" ? 28 : 48} />
              <span className="lines grow">
                <span>:{e.name}:</span>
                <small>
                  Added {e.createdBy ? `by ${e.createdBy} ` : ""}
                  {shortWhen(e.createdAt)}
                  {e.animated ? " · animated" : ""}
                </small>
              </span>
              {canManage && (
                <>
                  <button className="icon-btn" aria-label={`Rename :${e.name}:`} onClick={() => setRenaming(e)}>
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Remove :${e.name}:`}
                    disabled={act.busy}
                    onClick={() => void act.act(() => removeExpression(engine, orgId, e.id).then(() => setRev((r) => r + 1)))}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
          {list.data && items.length === 0 && <li className="faint">None yet.</li>}
        </ul>
      </Card>
    );
  };
  return (
    <div className="ws-page">
      <ErrorLine text={list.error ?? act.error} />
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setUploading({ kind, file: f });
          e.target.value = "";
        }}
      />
      {group("emoji")}
      {group("sticker")}
      {uploading && (
        <NameDialog
          title={`Upload ${uploading.kind === "emoji" ? "an emoji" : "a sticker"}`}
          initial={suggestName(uploading.file.name)}
          onClose={() => setUploading(null)}
          onSave={async (name) => {
            await uploadExpression(engine, orgId, uploading.kind, name, await prepare(uploading.file, uploading.kind));
            setRev((r) => r + 1);
          }}
        />
      )}
      {renaming && (
        <NameDialog
          title={`Rename :${renaming.name}:`}
          initial={renaming.name}
          onClose={() => setRenaming(null)}
          onSave={async (name) => {
            await renameExpression(engine, orgId, renaming.id, name);
            setRev((r) => r + 1);
          }}
        />
      )}
    </div>
  );
}

function NameDialog({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const act = useAction();
  const clean = name.trim().toLowerCase().replace(/^:|:$/g, "");
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          void act.act(async () => {
            await onSave(clean);
            onClose();
          });
        }}
      >
        <div className="field">
          <label htmlFor="ex-name">Name</label>
          <input id="ex-name" className="input mono" data-autofocus value={name} maxLength={34} onChange={(e) => setName(e.target.value)} placeholder="party_parrot" />
          <span className="hint">2–32 lowercase letters, digits or _. Used as :{clean || "name"}: in messages.</span>
        </div>
        <ErrorLine text={act.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={act.busy || !EXPRESSION_NAME.test(clean)}>
            {act.busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
