import { useState } from "react";
import type { DirectoryMember, OrgPermissions } from "../../api/workspaceSchemas";
import { useEngine } from "../../application/orbit";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { voiceBan } from "../../sync/communitySafety";
import type { MenuEntry } from "../components/Overlay";
import { Dialog } from "../components/Overlay";
import { NicknameDialog } from "../community/NicknameDialog";
import { useAction } from "./useLoad";
import { ErrorLine } from "./WorkspaceView";

/** The member menu's community parity A items: a nickname for them, and a voice ban. */
export type MemberParityDialog = "nickname" | "voiceBan";

interface EntriesInput {
  self: boolean;
  /** This person may act on them (never owners; admins only by the owner). */
  lower: boolean;
  permissions: OrgPermissions;
  features: readonly string[];
  open: (d: MemberParityDialog) => void;
}

const holds = (p: OrgPermissions, key: string) => p.isOwner || p.effective.includes(key);

export function memberParityEntries({ self, lower, permissions, features, open }: EntriesInput): MenuEntry[] {
  const entries: MenuEntry[] = [];
  if (features.includes(PARITY_FEATURES.permissions) && !self && lower && holds(permissions, "members.nicknames")) entries.push({ label: "Change nickname…", onSelect: () => open("nickname") });
  if (features.includes(PARITY_FEATURES.safety) && !self && lower && permissions.canBan) entries.push({ label: "Voice ban…", danger: true, onSelect: () => open("voiceBan") });
  return entries;
}

interface DialogsProps {
  which: MemberParityDialog | null;
  orgId: string;
  member: DirectoryMember;
  onClose: () => void;
  onSaved: () => void;
}

export function MemberParityDialogs({ which, orgId, member, onClose, onSaved }: DialogsProps) {
  if (which === "nickname") return <NicknameDialog orgId={orgId} userId={member.id} name={member.displayName} current={member.nickname ?? null} onClose={onClose} onSaved={onSaved} />;
  if (which === "voiceBan") return <VoiceBanDialog orgId={orgId} member={member} onClose={onClose} onSaved={onSaved} />;
  return null;
}

/** Voice ban (the reference's separate voice ban list): they still read and chat, but can't join voice channels. */
function VoiceBanDialog({ orgId, member, onClose, onSaved }: { orgId: string; member: DirectoryMember; onClose: () => void; onSaved: () => void }) {
  const engine = useEngine();
  const [reason, setReason] = useState("");
  const act = useAction();
  return (
    <Dialog title={`Voice ban ${member.displayName}?`} onClose={onClose}>
      <div className="dialog-body">
        <p style={{ margin: 0 }}>
          They're taken out of any voice call here and can't join this community's voice channels until you lift it (Community settings › Bans). They can still read and chat.
        </p>
        <label className="field">
          <span>Reason (optional, only moderators see it)</span>
          <input className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        </label>
        <ErrorLine text={act.error} />
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            disabled={act.busy}
            onClick={() =>
              void act.act(async () => {
                await voiceBan(engine, orgId, member.id, reason || null);
                onSaved();
                onClose();
              })
            }
          >
            Voice ban
          </button>
        </div>
      </div>
    </Dialog>
  );
}
