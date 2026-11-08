import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { EXPRESSION_NAME, type Expression, expressions, removeExpression, renameExpression, suggestName, uploadExpression } from "../../sync/expressions";
import { prepareExpression, type PreparedExpression } from "../../sync/prepareExpression";
import { CustomEmojiImage } from "../community/CustomEmoji";
import { Icon } from "../icons/Icon";
import { Dialog } from "../components/Overlay";
import { bytes, shortWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { ErrorLine } from "../components/SettingsCard";
/**
 * Emoji & stickers (batch B9, android ExpressionsScreen): Emoji · n/50 and Stickers · n/20, each with Upload (a picture
 * named `:like_this:`), rename and remove. For people who can manage emoji and stickers; every member can use them.
 */
export function ExpressionsPage({ detail, category }: { detail: OrgAdminDetail; category: "emoji" | "sticker" }) {
  useLocaleRender();
  const engine = useEngine();
  const orgId = detail.org.id;
  const [rev, setRev] = useState(0);
  const largeStickers = useOrbit((state) => state.server?.features.includes("stickers-512") ?? false);
  const list = useLoad(() => expressions(engine, orgId, true), [engine, orgId, rev]);
  const canManage = detail.permissions.isOwner || detail.permissions.effective.includes("expressions.manage");
  const [uploading, setUploading] = useState<{
    kind: "emoji" | "sticker";
    file: File;
  } | null>(null);
  const [renaming, setRenaming] = useState<Expression | null>(null);
  const act = useAction();
  const file = useRef<HTMLInputElement>(null);
  const k = category;
  const items = (list.data?.expressions ?? []).filter((e) => e.kind === k);
  const limit = list.data?.limits[k];
  const upload = canManage && limit !== undefined && (
    <button className="btn btn-primary" disabled={items.length >= limit} onClick={() => file.current?.click()}>
      <Icon name="files.upload" size={16} /> {uiText(k === "emoji" ? "workspace.reference.uploadEmoji" : "workspace.reference.uploadSticker")}
    </button>
  );
  const group = (
    <>
      <p className="muted">
        {k === "emoji" ? uiText("workspace.interface.members_use_them_in_this_community_s_channels_in_messages_and_as_f18720c") : uiText(largeStickers ? "workspace.reference.stickerHelp" : "workspace.interface.sent_on_their_own_shown_large_3a50ed7")}
      </p>
      <div className="ws-expression-actions">
        {upload}
        {limit !== undefined && <span className="muted">{uiText("workspace.reference.slotsUsed", { count: items.length, limit })}</span>}
      </div>
      {list.loading && <div className="skeleton" style={{ height: 72 }} aria-busy="true" />}
      {list.data && items.length === 0 && (
        <div className="ws-expression-empty">
          <img src="/meldling-192.webp" width="76" height="76" alt="" />
          <h2>{uiText(k === "emoji" ? "workspace.reference.noEmoji" : "workspace.reference.noStickers")}</h2>
          <p className="muted">{uiText(k === "emoji" ? "workspace.reference.emptyEmoji" : "workspace.reference.emptyStickers")}</p>
          {upload}
        </div>
      )}
      {items.length > 0 && (
        <ul className="ws-list">
          {items.map((e) => (
            <li key={e.id} className="ws-row">
              <CustomEmojiImage id={e.id} name={e.name} sha256={e.sha256} size={k === "emoji" ? 28 : 48} />
              <span className="lines grow">
                <span>:{e.name}:</span>
                <small>
                  <Localized
                    k="workspace.interface.added_a835dab"
                    slots={[
                      e.createdBy ? uiText("workspace.interface.by_value0_2c918de", { value0: e.createdBy }) : "",
                      shortWhen(e.createdAt),
                      e.animated ? uiText("workspace.interface.animated_97952c1") : "",
                    ]}
                  />
                </small>
              </span>
              {canManage && (
                <>
                  <button className="icon-btn" aria-label={uiText("workspace.interface.rename_value0_7f3d9e0", { value0: e.name })} onClick={() => setRenaming(e)}>
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={uiText("workspace.interface.remove_value0_36f7418", { value0: e.name })}
                    disabled={act.busy}
                    onClick={() => void act.act(() => removeExpression(engine, orgId, e.id).then(() => setRev((r) => r + 1)))}
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
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
          if (f) setUploading({ kind: category, file: f });
          e.target.value = "";
        }}
      />
      {group}
      {uploading && (
        <UploadDialog
          file={uploading.file}
          kind={uploading.kind}
          title={uiText("workspace.interface.upload_value0_d0166fa", {
            value0: uploading.kind === "emoji" ? uiText("workspace.interface.an_emoji_399e94c") : uiText("workspace.interface.a_sticker_7f2123d"),
          })}
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
          title={uiText("workspace.interface.rename_value0_7f3d9e0", { value0: renaming.name })}
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
  useLocaleRender();
  const l10n = useLocalization();
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
          <label htmlFor="ex-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input id="ex-name" className="input mono" data-autofocus value={name} maxLength={34} onChange={(e) => setName(e.target.value)} placeholder={"party_parrot"} />
          <span className="hint">
            <Localized k="workspace.interface.2_32_lowercase_letters_digits_or_used_as_in_messages_48ed796" slots={[clean || uiText("workspace.interface.name_82a3537")]} />
          </span>
        </div>
        <ErrorLine text={act.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!ready || act.busy || !EXPRESSION_NAME.test(clean)}>
            {act.busy ? l10n("common.common_saving") : l10n("common.actions.save")}
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
  useLocaleRender();
  const largeStickers = useOrbit((state) => state.server?.features.includes("stickers-512") ?? false);
  const [prepared, setPrepared] = useState<
    | (PreparedExpression & {
        url: string;
      })
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    void prepareExpression(file, kind, largeStickers)
      .then((p) => {
        if (!live) return;
        url = URL.createObjectURL(new Blob([p.bytes], { type: p.mime }));
        setPrepared({ ...p, url });
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_prepare_this_picture_1ca53ef"));
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, kind, largeStickers]);
  return (
    <NameDialog
      {...props}
      ready={!!prepared}
      onSave={(name) => (prepared ? props.onSave(name, prepared.bytes) : Promise.resolve())}
      preview={
        <div className="expression-upload-preview">
          {prepared && (
            <img
              src={prepared.url}
              alt={uiText("workspace.interface.upload_preview_6f777ab")}
              style={{ width: kind === "emoji" ? 64 : 128, height: kind === "emoji" ? 64 : 128, objectFit: "contain" }}
            />
          )}
          <p className="hint">
            <Localized k={kind === "sticker" && largeStickers ? "workspace.reference.stickerMax" : "workspace.interface.256_kb_maximum_8751644"} slots={[file.name, bytes(prepared?.bytes.length ?? file.size)]} />
          </p>
          {prepared && (
            <p className="hint">
              {prepared.converted
                ? uiText("workspace.interface.resized_and_converted_to_png_the_preview_shows_what_members_will_4790279")
                : uiText("workspace.interface.original_image_kept_including_any_animation_f104c1f")}
            </p>
          )}
          {!prepared && !error && (
            <p role="status">
              <Localized k="workspace.interface.preparing_preview_11e66e1" />
            </p>
          )}
          <ErrorLine text={error} />
        </div>
      }
    />
  );
}
