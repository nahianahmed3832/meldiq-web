import { RecentActivity } from "../experience/RecentActivity";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Compass, MessageSquare, Plus } from "lucide-react";
import { useOrbit } from "../../application/orbit";
import { navigate, type Section } from "../../application/router";
import { MeldlingArt } from "../components/MeldlingArt";
import type { ShellDialog } from "../shell/Shell";
/** A quiet fallback when there is no lobby or accessible text channel to open. */
export function HomeView({ orgId, onDialog }: { orgId: string | null; section: Section; onDialog: (d: ShellDialog) => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === orgId));
  const synced = useOrbit((s) => s.synced);
  return (
    <section className="main community-welcome" aria-label={org ? uiText("workspace.interface.value0_channels_491394a", { value0: org.name }) : l10n("onboarding.welcome")} aria-busy={!synced}>
      <div className="empty">
        <MeldlingArt pose="hello" size={112} />
        <h1>{org ? org.name : l10n("onboarding.welcome")}</h1>
        <p className="muted">
          {!synced
            ? uiText("workspace.interface.opening_your_conversations_3af7cb1")
            : org
              ? uiText("workspace.interface.choose_a_channel_from_the_sidebar_to_start_talking_7d42b1d")
              : uiText("workspace.interface.your_people_and_communities_all_in_one_place_dc12128")}
        </p>
        {synced && (
          <div className="home-actions">
            {org ? (
              <button className="btn btn-secondary" onClick={() => onDialog({ kind: "channels" })}>
                <Localized k="workspace.interface.browse_channels_e0116db" slots={[<Compass size={16} />]} />
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => onDialog({ kind: "new" })}>
                  <MessageSquare size={16} /> {l10n("workspace.side_new_message")}
                </button>
                <button className="btn btn-secondary" onClick={() => navigate({ section: "discover" })}>
                  <Compass size={16} /> {l10n("workspace.rail_discover")}
                </button>
                <button className="btn btn-ghost" onClick={() => onDialog({ kind: "createWorkspace" })}>
                  <Plus size={16} /> {l10n("workspace.rail_create")}
                </button>
              </>
            )}
          </div>
        )}
        {synced && <RecentActivity compact />}
      </div>
    </section>
  );
}
