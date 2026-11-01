import { Compass, MessageSquare, Plus } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { MeldlingArt } from "../components/MeldlingArt";
import type { ShellDialog } from "../shell/Shell";

/** A quiet fallback when there is no lobby or accessible text channel to open. */
export function HomeView({ orgId, onDialog }: { orgId: string | null; section: Section; onDialog: (d: ShellDialog) => void }) {
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId));
  const synced = useOrbit((s) => s.synced);
  return (
    <section className="main community-welcome" aria-label={org ? `${org.name} channels` : "Welcome to Meldiq"} aria-busy={!synced}>
      <div className="empty">
        <MeldlingArt pose="hello" size={112} />
        <h1>{org ? org.name : "Welcome to Meldiq"}</h1>
        <p className="muted">{!synced ? "Opening your conversations…" : org ? "Choose a channel from the sidebar to start talking." : "Your people and communities, all in one place."}</p>
        {synced && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {org ? (
              <button className="btn btn-secondary" onClick={() => onDialog({ kind: "channels" })}>
                <Compass size={16} /> Browse channels
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => onDialog({ kind: "new" })}>
                  <MessageSquare size={16} /> New message
                </button>
                <button className="btn btn-secondary" onClick={() => navigate({ section: "discover" })}>
                  <Compass size={16} /> Discover communities
                </button>
                <button className="btn btn-ghost" onClick={() => onDialog({ kind: "createWorkspace" })}>
                  <Plus size={16} /> Create a community
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
