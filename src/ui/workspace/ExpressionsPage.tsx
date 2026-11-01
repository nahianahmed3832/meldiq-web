import { Pencil, Trash2, Upload } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { EXPRESSION_NAME, type Expression, expressions, removeExpression, renameExpression, suggestName, uploadExpression } from "../../sync/expressions";
import { prepareExpression, type PreparedExpression } from "../../sync/prepareExpression";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { Dialog } from "../components/Overlay";
import { bytes, shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

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
        <UploadDialog
          file={uploading.file}
          kind={uploading.kind}
          title={`Upload ${uploading.kind === "emoji" ? "an emoji" : "a sticker"}`}
          initial={suggestName(uploading.file.name)}
          onClose={() => setUploading(null)}
          onSave={async (name, prepared) => {
            await uploadExpression(engine, orgId, uploading.kind, name, prepared);
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

function NameDialog({
  title,
  initial,
  onSave,
  onClose,
  preview,
  ready = true,
}: {
  title: string;
  initial: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
  preview?: ReactNode;
  ready?: boolean;
}) {
  const [name, setName] = useState(initial);
  const act = useAction();
  const clean = name.trim().toLowerCase().replace(/^:|:$/g, "");
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready || act.busy || !EXPRESSION_NAME.test(clean)) return;
          void act.act(async () => {
            await onSave(clean);
            onClose();
          });
        }}
      >
        {preview}
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
          <button className="btn btn-primary" disabled={!ready || act.busy || !EXPRESSION_NAME.test(clean)}>
            {act.busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Preview the exact bytes that will be uploaded, and surface local preparation failures before saving. */
export function UploadDialog({
  file,
  kind,
  ...props
}: {
  file: File;
  kind: "emoji" | "sticker";
  title: string;
  initial: string;
  onSave: (name: string, bytes: Uint8Array) => Promise<void>;
  onClose: () => void;
}) {
  const [prepared, setPrepared] = useState<(PreparedExpression & { url: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    void prepareExpression(file, kind)
      .then((p) => {
        if (!live) return;
        url = URL.createObjectURL(new Blob([p.bytes], { type: p.mime }));
        setPrepared({ ...p, url });
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Couldn't prepare this picture.");
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, kind]);
  return (
    <NameDialog
      {...props}
      ready={!!prepared}
      onSave={(name) => (prepared ? props.onSave(name, prepared.bytes) : Promise.resolve())}
      preview={
        <div className="expression-upload-preview">
          {prepared && <img src={prepared.url} alt="Upload preview" style={{ width: kind === "emoji" ? 64 : 128, height: kind === "emoji" ? 64 : 128, objectFit: "contain" }} />}
          <p className="hint">
            {file.name} · {bytes(prepared?.bytes.length ?? file.size)} · 256 KB maximum
          </p>
          {prepared && <p className="hint">{prepared.converted ? "Resized and converted to PNG. The preview shows what members will see." : "Original image kept, including any animation."}</p>}
          {!prepared && !error && <p role="status">Preparing preview…</p>}
          <ErrorLine text={error} />
        </div>
      }
    />
  );
}
