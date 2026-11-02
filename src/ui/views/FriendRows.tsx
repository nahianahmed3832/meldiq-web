import { MessageCircle, MoreVertical, UserMinus } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { Menu, useMenu } from "../components/Overlay";
import { LookAvatar, StyledName, useUserLook } from "../people/NameStyle";

/** The Friends page's lists (FriendsView, SuggestedPeople): a titled group, and a person's row with its actions. */

export function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="friends-group">
      <h3>{title}</h3>
      {children.length ? <div role="list">{children}</div> : <p className="friends-empty">{empty}</p>}
    </div>
  );
}

export function FriendRow(p: {
  p: { id: string; username: string; displayName: string; avatarColor: number; statusText?: string | null };
  online: boolean;
  sub?: string;
  onMessage?: () => void;
  actions?: React.ReactNode;
  more?: { label: string; danger?: boolean; run: () => void }[];
}) {
  const look = useUserLook(p.p.id);
  const photo = useOrbit((s) => s.users[p.p.id]?.photoRev ?? null);
  const menu = useMenu();
  return (
    <div className="friend-row" role="listitem">
      <LookAvatar userId={p.p.id} name={p.p.displayName} colorIndex={p.p.avatarColor} photoRev={photo} size={36} online={p.online} />
      <span className="lines grow">
        <strong className="ellipsis">
          <StyledName name={p.p.displayName} style={look.profileStyle} tag={look.tag} mojo={look.mojo} bot={look.bot} className="ellipsis" />
          {p.p.username && <small className="friend-handle"> @{p.p.username}</small>}
        </strong>
        <small className="ellipsis">{p.sub ?? (p.p.statusText || (p.online ? "Online" : "Offline"))}</small>
      </span>
      <span className="friend-actions">
        {p.actions}
        {p.onMessage && (
          <button className="icon-btn" onClick={p.onMessage} aria-label={`Message ${p.p.displayName}`} title="Message">
            <MessageCircle size={18} />
          </button>
        )}
        {p.more && (
          <button className="icon-btn" onClick={(e) => menu.open(e.currentTarget)} aria-label={`More for ${p.p.displayName}`} aria-haspopup="menu">
            <MoreVertical size={18} />
          </button>
        )}
      </span>
      {menu.anchor && p.more && (
        <Menu
          anchor={menu.anchor}
          align="end"
          label={p.p.displayName}
          onClose={menu.close}
          entries={p.more.map((m) => ({ label: m.label, danger: m.danger, icon: <UserMinus size={16} />, onSelect: m.run }))}
        />
      )}
    </div>
  );
}
