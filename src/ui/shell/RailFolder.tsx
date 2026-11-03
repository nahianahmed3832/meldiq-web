import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Folder, FolderOpen, Pencil, Ungroup } from "lucide-react";
import { type FormEvent, useState } from "react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { renameFolder, type RailFolder, type RailState, ungroupFolder } from "../../sync/railFolders";
import { OrgAvatar } from "../components/OrgAvatar";
import { contextMenuProps, Dialog, Menu, useMenu } from "../components/Overlay";
import { capCount } from "../unread";
import { CommunityButton, type RailOrg } from "./RailCommunity";
import type { ShellDialog } from "./Shell";
/** Colours a folder can take (none: the rail's own). */
const FOLDER_COLORS = ["#5865f2", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#a855f7"];
/**
 * A folder on the rail (2026-10-28, after the owner's reference): closed, a tile with up to four of its communities and
 * their mentions added up; open, a tinted column of them under a folder tile. Click opens or closes it (remembered on
 * this browser); right-click (or a held finger) renames, recolours or ungroups it. It's dragged as one item.
 */
export function RailFolderItem(p: { folder: RailFolder; orgs: RailOrg[]; selectedId: string | null; state: RailState; onChange: (next: RailState) => void; onDialog: (d: ShellDialog) => void }) {
  useLocaleRender();
  const { railFoldersOpen } = usePrefs();
  const open = railFoldersOpen.includes(p.folder.id);
  const menu = useMenu();
  const [editing, setEditing] = useState(false);
  const mentions = p.orgs.reduce((n, o) => n + o.mentions, 0);
  const unread = p.orgs.some((o) => o.unread > 0);
  const hasSelected = p.orgs.some((o) => o.id === p.selectedId);
  const name = p.folder.name || p.orgs.map((o) => o.name).join(", ");
  const toggle = () => setPrefs({ railFoldersOpen: open ? railFoldersOpen.filter((x) => x !== p.folder.id) : [...railFoldersOpen, p.folder.id] });
  return (
    <div className={`rail-folder${open ? " open" : ""}`} style={p.folder.color ? ({ "--folder": p.folder.color } as React.CSSProperties) : undefined}>
      <button
        className={`rail-folder-tile${!open && unread ? " unread" : ""}${!open && hasSelected ? " holds-selected" : ""}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label={uiText("workspace.interface.folder_value0_value1_communities_value2_afc5f59", {
          value0: name,
          value1: p.orgs.length,
          value2: mentions ? uiText("workspace.interface.mentions_64cc1b0", { value0: mentions }) : "",
        })}
        title={name}
        data-drag={p.folder.id}
        data-drag-kind="folder"
        data-drag-into="true"
        {...contextMenuProps(menu.openAt)}
      >
        {open ? (
          <FolderOpen size={22} aria-hidden="true" />
        ) : (
          <span className="rail-folder-grid" aria-hidden="true">
            {p.orgs.slice(0, 4).map((o) => (
              <OrgAvatar key={o.id} orgId={o.id} name={o.name} photoRev={o.photoRev} size={18} />
            ))}
          </span>
        )}
        {!open && mentions > 0 && <span className="count mention-count rail-folder-count">{capCount(mentions)}</span>}
      </button>
      {open && (
        <div className="rail-folder-members" role="group" aria-label={name}>
          {p.orgs.map((o) => (
            <CommunityButton key={o.id} org={o} selected={o.id === p.selectedId} size={40} onDialog={p.onDialog} drag={{ group: p.folder.id, into: false }} />
          ))}
        </div>
      )}
      {menu.anchor && (
        <Menu
          anchor={menu.anchor}
          point={menu.point}
          label={name}
          onClose={menu.close}
          entries={[
            { label: open ? uiText("workspace.interface.close_folder_0bec7d1") : uiText("workspace.interface.open_folder_f963014"), icon: <Folder size={16} />, onSelect: toggle },
            {
              get label() {
                return uiText("workspace.interface.folder_settings_56fdc82");
              },
              icon: <Pencil size={16} />,
              onSelect: () => setEditing(true),
            },
            "separator",
            {
              get label() {
                return uiText("workspace.interface.ungroup_b57ef47");
              },
              icon: <Ungroup size={16} />,
              onSelect: () => p.onChange(ungroupFolder(p.state, p.folder.id)),
            },
          ]}
        />
      )}
      {editing && (
        <FolderDialog
          folder={p.folder}
          onClose={() => setEditing(false)}
          onSave={(n, c) => {
            p.onChange(renameFolder(p.state, p.folder.id, n, c));
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
function FolderDialog({ folder, onClose, onSave }: { folder: RailFolder; onClose: () => void; onSave: (name: string, color: string | null) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState<string | null>(folder.color);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(name, color);
  };
  return (
    <Dialog title={uiText("workspace.interface.folder_settings_9644ab6")} onClose={onClose}>
      <form className="dialog-body" onSubmit={submit}>
        <label className="field">
          <span>
            <Localized k="workspace.interface.folder_name_14d34ed" />
          </span>
          <input className="input" value={name} maxLength={40} placeholder={uiText("workspace.interface.its_communities_names_0aa9469")} onChange={(e) => setName(e.target.value)} data-autofocus />
        </label>
        <div className="field">
          <span>{l10n("settings.ap_colour")}</span>
          <div className="folder-colors" role="radiogroup" aria-label={uiText("workspace.interface.folder_colour_9eab1db")}>
            <button type="button" role="radio" aria-checked={color === null} className="folder-color none" onClick={() => setColor(null)}>
              {l10n("settings.ap_none")}
            </button>
            {FOLDER_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} className="folder-color" style={{ background: c }} aria-label={c} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {l10n("common.actions.cancel")}
          </button>
          <button className="btn btn-primary">{l10n("common.actions.save")}</button>
        </div>
      </form>
    </Dialog>
  );
}
