import { confirmAction } from "../components/ConfirmationDialog";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Pin, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { type CommunityPin, communityPins, createPin, deletePin, givePin, pinFileProblem, pinHolders, pinImage, takePinBack } from "../../sync/pins";
import { directory } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
/**
 * Community settings › Pins (API 0.64.0, server docs/PROFILE_PINS.md): the community's own pins, which its owners and
 * admins make and give to members; members wear them on their profile. Every member can see the pins and who has each.
 */
export function PinsPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const orgId = detail.org.id;
  const [rev, setRev] = useState(0);
  const list = useLoad(() => communityPins(engine, orgId), [engine, orgId, rev]);
  const [making, setMaking] = useState(false);
  const [open, setOpen] = useState<CommunityPin | null>(null);
  const remove = useAction();
  const pins = list.data?.pins ?? [];
  const canManage = list.data?.canManage ?? false;
  const limit = list.data?.limit ?? 30;
  const reload = () => setRev((r) => r + 1);
  return (
    <Card
      title={uiText("workspace.interface.pins_value0_value1_c6d78de", { value0: pins.length, value1: limit })}
      sub={
        detail.org.visibility === "public"
          ? uiText("workspace.interface.pins_your_members_wear_on_their_profile_beside_meldiq_s_own_every_c9a03be")
          : uiText("workspace.interface.pins_your_members_wear_on_their_profile_beside_meldiq_s_own_as_th_c503ed3")
      }
      actions={
        canManage && (
          <button className="btn btn-secondary btn-sm" disabled={pins.length >= limit} onClick={() => setMaking(true)}>
            <Localized k="workspace.interface.make_a_pin_6bd3f71" slots={[<Plus size={14} />]} />
          </button>
        )
      }
    >
      <ErrorLine text={list.error ?? remove.error} />
      {!list.data && !list.error && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      {list.data && pins.length === 0 && (
        <p className="faint" style={{ margin: 0 }}>
          {canManage
            ? uiText("workspace.interface.no_pins_yet_make_one_like_top_helper_or_event_winner_and_give_it_c556f43")
            : uiText("workspace.interface.this_community_hasn_t_made_any_pins_yet_7e1a0da")}
        </p>
      )}
      {pins.length > 0 && (
        <ul className="pin-list">
          {pins.map((p) => (
            <li key={p.id} className="pin-item">
              <img src={pinImage(p.id)} alt="" width={40} height={40} />
              <span className="grow">
                <strong className="ellipsis">{p.name}</strong>
                <small className="faint ellipsis">{[p.description, uiText("workspace.pinHolders", { count: p.holders })].filter(Boolean).join(" · ")}</small>
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(p)}>
                {canManage ? uiText("workspace.interface.give_or_take_back_5943cb1") : uiText("workspace.interface.who_has_it_e38b555")}
              </button>
              {canManage && (
                <button
                  className="icon-btn"
                  aria-label={uiText("organization.interface.delete_value0_8782b77", { value0: p.name })}
                  title={l10n("common.actions.delete")}
                  disabled={remove.busy}
                  onClick={async () => {
                    if (!(await confirmAction(uiText("workspace.interface.delete_value0_it_comes_off_everyone_who_has_it_445f1b2", { value0: p.name })))) return;
                    void remove.act(() => deletePin(engine, orgId, p.id)).then((ok) => ok && reload());
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {making && (
        <MakePinDialog
          orgId={orgId}
          onClose={() => setMaking(false)}
          onMade={() => {
            setMaking(false);
            reload();
          }}
        />
      )}
      {open && <HoldersDialog orgId={orgId} pin={open} canManage={canManage} onClose={() => setOpen(null)} onChanged={reload} />}
    </Card>
  );
}
function MakePinDialog({ orgId, onClose, onMade }: { orgId: string; onClose: () => void; onMade: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useAction();
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    const issue = await pinFileProblem(f);
    setProblem(issue);
    if (preview) URL.revokeObjectURL(preview);
    setFile(issue ? null : f);
    setPreview(issue ? null : URL.createObjectURL(f));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file || name.trim().length < 2) return;
    void save.act(async () => createPin(engine, orgId, name, description, new Uint8Array(await file.arrayBuffer()))).then((ok) => ok && onMade());
  };
  return (
    <Dialog title={uiText("workspace.interface.make_a_pin_f1440cd")} onClose={onClose}>
      <form className="dialog-body" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <span className="pin-drop">{preview ? <img src={preview} alt="" width={56} height={56} /> : <Pin size={22} aria-hidden="true" />}</span>
          <div style={{ display: "grid", gap: 4 }}>
            <input ref={input} type="file" hidden accept="image/png,image/webp,image/gif" onChange={(e) => void pick(e.target.files?.[0])} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}>
              {file ? uiText("workspace.interface.choose_another_image_f0763cc") : uiText("workspace.interface.choose_an_image_ceed9fd")}
            </button>
            <small className="faint">
              <Localized k="workspace.interface.a_square_png_webp_or_gif_64_to_512_px_128_128_works_well_up_to_51_ded9582" />
            </small>
          </div>
        </div>
        <ErrorLine text={problem} />
        <div className="field">
          <label htmlFor="pin-name">
            <Localized k="messaging.interface.name_dcd1d52" />
          </label>
          <input id="pin-name" className="input" value={name} maxLength={32} placeholder={uiText("workspace.interface.top_helper_270aa87")} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pin-desc">
            <Localized k="workspace.interface.what_it_s_for_optional_44e6c41" />
          </label>
          <input
            id="pin-desc"
            className="input"
            value={description}
            maxLength={120}
            placeholder={uiText("workspace.interface.answered_100_questions_in_help_5f0827b")}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <ErrorLine text={save.error} />
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary btn-sm" disabled={!file || name.trim().length < 2 || save.busy}>
            {save.busy ? uiText("workspace.interface.making_398c838") : uiText("workspace.interface.make_pin_ea74acb")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function HoldersDialog({ orgId, pin, canManage, onClose, onChanged }: { orgId: string; pin: CommunityPin; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  useLocaleRender();
  const engine = useEngine();
  const [rev, setRev] = useState(0);
  const [q, setQ] = useState("");
  const holders = useLoad(() => pinHolders(engine, orgId, pin.id), [engine, orgId, pin.id, rev]);
  const members = useLoad(() => (canManage ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, canManage, q]);
  const act = useAction();
  const has = useMemo(() => new Set((holders.data ?? []).map((h) => h.userId)), [holders.data]);
  const change = (userId: string, give: boolean) =>
    void act
      .act(() => (give ? givePin(engine, orgId, pin.id, userId) : takePinBack(engine, orgId, pin.id, userId)))
      .then((ok) => {
        if (!ok) return;
        setRev((r) => r + 1);
        onChanged();
      });
  return (
    <Dialog title={pin.name} onClose={onClose}>
      <div className="dialog-body" style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <img src={pinImage(pin.id)} alt="" width={48} height={48} />
          <span className="faint">{pin.description ?? uiText("workspace.interface.a_pin_from_this_community_0149f08")}</span>
        </div>
        <ErrorLine text={act.error ?? holders.error} />
        <h3 className="invite-or-title">
          <Localized k="workspace.interface.who_has_it_e38b555" />
        </h3>
        {holders.data?.length === 0 && (
          <p className="faint" style={{ margin: 0 }}>
            <Localized k="workspace.interface.nobody_yet_441ed85" />
          </p>
        )}
        <ul className="pin-people">
          {(holders.data ?? []).map((h) => (
            <li key={h.userId}>
              <Avatar name={h.displayName} colorIndex={0} size={28} decorative />
              <span className="grow ellipsis">
                {h.displayName} {h.username && <small className="faint">@{h.username}</small>}
              </span>
              {canManage && (
                <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => change(h.userId, false)}>
                  <Localized k="workspace.interface.take_back_6e14c76" slots={[<UserMinus size={14} />]} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <>
            <h3 className="invite-or-title">
              <Localized k="workspace.interface.give_it_to_2a36e9a" />
            </h3>
            <input
              className="input"
              type="search"
              value={q}
              placeholder={uiText("workspace.interface.search_members_6497fc6")}
              aria-label={uiText("workspace.interface.search_members_6497fc6")}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="pin-people">
              {(members.data ?? [])
                .filter((m) => !has.has(m.id))
                .slice(0, 30)
                .map((m) => (
                  <li key={m.id}>
                    <Avatar name={m.displayName} colorIndex={m.avatarColor} size={28} decorative />
                    <span className="grow ellipsis">
                      {m.displayName} <small className="faint">@{m.username}</small>
                    </span>
                    <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => change(m.id, true)}>
                      <Localized k="workspace.interface.give_5aeabb9" slots={[<UserPlus size={14} />]} />
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </Dialog>
  );
}
