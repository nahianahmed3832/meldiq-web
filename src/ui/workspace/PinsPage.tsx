import { Pin, Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { type CommunityPin, communityPins, createPin, deletePin, givePin, pinFileProblem, pinHolders, pinImage, takePinBack } from "../../sync/pins";
import { directory } from "../../sync/workspaces";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Community settings › Pins (API 0.64.0, server docs/PROFILE_PINS.md): the community's own pins, which its owners and
 * admins make and give to members; members wear them on their profile. Every member can see the pins and who has each.
 */
export function PinsPage({ detail }: { detail: OrgAdminDetail }) {
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
      title={`Pins · ${pins.length}/${limit}`}
      sub={
        detail.org.visibility === "public"
          ? "Pins your members wear on their profile, beside Meldiq's own. Everyone sees them, since this community is public."
          : "Pins your members wear on their profile, beside Meldiq's own. As this community is private, only its members see them."
      }
      actions={
        canManage && (
          <button className="btn btn-secondary btn-sm" disabled={pins.length >= limit} onClick={() => setMaking(true)}>
            <Plus size={14} /> Make a pin
          </button>
        )
      }
    >
      <ErrorLine text={list.error ?? remove.error} />
      {!list.data && !list.error && <div className="skeleton" style={{ height: 80 }} aria-busy="true" />}
      {list.data && pins.length === 0 && (
        <p className="faint" style={{ margin: 0 }}>
          {canManage ? "No pins yet. Make one, like “Top helper” or “Event winner”, and give it to members." : "This community hasn't made any pins yet."}
        </p>
      )}
      {pins.length > 0 && (
        <ul className="pin-list">
          {pins.map((p) => (
            <li key={p.id} className="pin-item">
              <img src={pinImage(p.id)} alt="" width={40} height={40} />
              <span className="grow">
                <strong className="ellipsis">{p.name}</strong>
                <small className="faint ellipsis">{[p.description, `${p.holders} ${p.holders === 1 ? "member has" : "members have"} it`].filter(Boolean).join(" · ")}</small>
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(p)}>
                {canManage ? "Give or take back" : "Who has it"}
              </button>
              {canManage && (
                <button
                  className="icon-btn"
                  aria-label={`Delete ${p.name}`}
                  title="Delete"
                  disabled={remove.busy}
                  onClick={() => {
                    if (!window.confirm(`Delete "${p.name}"? It comes off everyone who has it.`)) return;
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
    <Dialog title="Make a pin" onClose={onClose}>
      <form className="dialog-body" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <span className="pin-drop">{preview ? <img src={preview} alt="" width={56} height={56} /> : <Pin size={22} aria-hidden="true" />}</span>
          <div style={{ display: "grid", gap: 4 }}>
            <input ref={input} type="file" hidden accept="image/png,image/webp,image/gif" onChange={(e) => void pick(e.target.files?.[0])} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}>
              {file ? "Choose another image" : "Choose an image"}
            </button>
            <small className="faint">A square PNG, WebP or GIF, 64 to 512 px (128 × 128 works well), up to 512 KB. GIFs stay animated.</small>
          </div>
        </div>
        <ErrorLine text={problem} />
        <div className="field">
          <label htmlFor="pin-name">Name</label>
          <input id="pin-name" className="input" value={name} maxLength={32} placeholder="Top helper" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pin-desc">What it's for (optional)</label>
          <input id="pin-desc" className="input" value={description} maxLength={120} placeholder="Answered 100 questions in #help" onChange={(e) => setDescription(e.target.value)} />
        </div>
        <ErrorLine text={save.error} />
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" disabled={!file || name.trim().length < 2 || save.busy}>
            {save.busy ? "Making…" : "Make pin"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function HoldersDialog({ orgId, pin, canManage, onClose, onChanged }: { orgId: string; pin: CommunityPin; canManage: boolean; onClose: () => void; onChanged: () => void }) {
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
          <span className="faint">{pin.description ?? "A pin from this community."}</span>
        </div>
        <ErrorLine text={act.error ?? holders.error} />
        <h3 className="invite-or-title">Who has it</h3>
        {holders.data?.length === 0 && (
          <p className="faint" style={{ margin: 0 }}>
            Nobody yet.
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
                  <UserMinus size={14} /> Take back
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <>
            <h3 className="invite-or-title">Give it to</h3>
            <input className="input" type="search" value={q} placeholder="Search members" aria-label="Search members" onChange={(e) => setQ(e.target.value)} />
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
                      <UserPlus size={14} /> Give
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
