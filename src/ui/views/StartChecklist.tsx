import { CheckCircle2, Circle, X } from "lucide-react";
import { useCommunityServer, useOrbit } from "../../app/orbit";
import { setPrefs, usePrefs } from "../../app/prefs";
import { navigate } from "../../app/router";
import type { ShellDialog } from "../shell/Shell";
import { type StartStep, startProgress, startVisible } from "./startRules";

const notificationsAllowed = (): boolean => typeof Notification !== "undefined" && Notification.permission === "granted";

/**
 * Get started (android HomeStart): the first things a new person does in Meldiq, each one a click away, checked off from
 * real state (a photo, a workspace or community, someone invited, notifications). Nothing is forced; the card can be hidden and goes away
 * by itself once the required steps are done.
 */
export function StartChecklist({ orgId, onDialog }: { orgId: string | null; onDialog: (d: ShellDialog) => void }) {
  const prefs = usePrefs();
  const community = useCommunityServer();
  const facts = useOrbit(
    (s) => ({
      photo: !!(s.me && s.users[s.me.userId]?.photoRev),
      workspaces: s.orgs.length,
      members: s.orgs.find((o) => o.id === orgId)?.memberCount ?? 0,
    }),
    (a, b) => a.photo === b.photo && a.workspaces === b.workspaces && a.members === b.members,
  );
  const steps: (StartStep & { go: () => void })[] = [
    { key: "profile", label: "Add your name and photo", done: facts.photo, go: () => navigate({ section: "settings", settingsPage: "profile" }) },
    { key: "workspace", label: community ? "Start or join a community" : "Create or join a workspace", done: facts.workspaces > 0, go: () => onDialog({ kind: "joinWorkspace" }) },
    {
      key: "invite",
      label: community ? "Invite your friends" : "Invite your teammates",
      done: facts.members > 1,
      go: () => (orgId ? navigate({ section: "workspace", workspacePage: "invitations" }) : onDialog({ kind: "createWorkspace" })),
    },
    { key: "notifications", label: "Turn on notifications", done: prefs.notifications && notificationsAllowed(), go: () => navigate({ section: "settings", settingsPage: "notifications" }) },
    // Meldiq B15: no "Connect the tools you use" step: app connections were retired with the community rebuild, and the
    // step led to a page the server no longer offers.
  ];
  if (!startVisible(prefs.startHidden, steps)) return null;
  const { done, total } = startProgress(steps);
  return (
    <section className="card start-card" aria-label="Get started with Meldiq">
      <header className="row" style={{ gap: 8 }}>
        <div className="grow">
          <h2>Get started with Meldiq</h2>
          <small className="faint">
            {done} of {total} done
          </small>
        </div>
        <button className="icon-btn" onClick={() => setPrefs({ startHidden: true })} aria-label="Hide Get started">
          <X size={16} />
        </button>
      </header>
      <progress max={total} value={done} aria-hidden="true" />
      <ul>
        {steps.map((s) => (
          <li key={s.key}>
            <button className={`start-step${s.done ? " done" : ""}`} onClick={s.go} disabled={s.done}>
              {s.done ? <CheckCircle2 size={18} aria-label="Done" /> : <Circle size={18} aria-hidden="true" />}
              <span className="grow">{s.label}</span>
              {s.optional && !s.done && <span className="tag">Optional</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
