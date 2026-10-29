import { HelpCircle, Info, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Conversation, Org } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { type ChannelAbilities, channelAbilities, communityHold, type ComposerHold } from "../../sync/channelGates";
import { PARITY_FEATURES } from "../../sync/communityParity";
import { clearComposerNote, type ComposerNote, useComposerNote } from "../../sync/composerNotes";
import type { Engine } from "../../sync/engine";
import type { MentionRole } from "../../sync/roleMentions";
import { rolesOverview } from "../../sync/roles";
import { useCommunityAccess, useFeature } from "../community/useCommunityAccess";
import { OnboardingFlow } from "../community/OnboardingFinish";
import { untilWhen } from "../format";

export interface ComposerGates {
  abilities: ChannelAbilities;
  hold: ComposerHold | null;
  note: ComposerNote | null;
  /** Roles the mention list may offer (already filtered to what this person may mention). */
  roles: MentionRole[];
}

const rolesCache = new Map<string, Promise<MentionRole[]>>();

function mentionRoles(engine: Engine, orgId: string): Promise<MentionRole[]> {
  let p = rolesCache.get(orgId);
  if (!p) {
    p = rolesOverview(engine, orgId)
      .then((o) => o.roles.filter((r) => !r.archived).map((r) => ({ id: r.id, name: r.name, color: r.color ?? null, mentionable: r.extras?.mentionable ?? false })))
      // Without roles.view the list stays empty: role mentions are typed by name.
      .catch(() => []);
    rolesCache.set(orgId, p);
  }
  return p;
}

/** What the composer offers in [c] and why it's held back (community parity A1–A3). */
export function useComposerGates(c: Conversation): ComposerGates {
  const engine = useEngine();
  const orgId = c.type === "CHANNEL" ? c.orgId : null;
  const access = useCommunityAccess(orgId);
  const permissionsOn = useFeature(PARITY_FEATURES.permissions);
  const org = useOrbit((s) => (orgId ? (s.orgs.find((o) => o.id === orgId) ?? null) : null));
  const note = useComposerNote(c.id);
  const [roles, setRoles] = useState<MentionRole[]>([]);
  useEffect(() => {
    if (!orgId || !permissionsOn) return setRoles([]);
    let alive = true;
    void mentionRoles(engine, orgId).then((r) => alive && setRoles(r));
    return () => {
      alive = false;
    };
  }, [engine, orgId, permissionsOn]);
  const abilities = channelAbilities(c, access, permissionsOn);
  const hold = orgId ? communityHold(org, abilities) : null;
  return { abilities, hold, note, roles: roles.filter((r) => abilities.mentionAnyRole || r.mentionable) };
}

/** In place of the composer: finish onboarding, the community is locked, or the channel is read-only. */
export function ComposerHoldBar({ hold, org }: { hold: ComposerHold; org: Pick<Org, "id"> }) {
  const [flow, setFlow] = useState(false);
  if (hold.kind === "onboarding") {
    return (
      <div className="composer-wrap">
        <div className="composer-locked" role="note">
          <HelpCircle size={16} />
          <span className="grow">Finish this community's onboarding to start chatting. You can read everything meanwhile.</span>
          <button className="btn btn-primary btn-sm" onClick={() => setFlow(true)}>
            Finish onboarding
          </button>
        </div>
        {flow && <OnboardingFlow orgId={org.id} onClose={() => setFlow(false)} />}
      </div>
    );
  }
  return (
    <div className="composer-wrap">
      <div className="composer-locked" role="note">
        <Lock size={16} />
        {hold.kind === "locked"
          ? `This community is locked and unlocks ${untilWhen(hold.until)}. Only moderators can post right now.`
          : "This channel is read-only. Everyone can read and react; only some roles can post."}
      </div>
    </div>
  );
}

/** The latest refusal, explained above the composer until closed. */
export function ComposerNoteLine({ conversationId, note }: { conversationId: string; note: ComposerNote }) {
  return (
    <div className="composer-slowmode composer-note" role="status" aria-live="polite">
      <Info size={14} aria-hidden="true" />
      <span className="grow">{note.text}</span>
      <button className="icon-btn icon-btn-xs" aria-label="Close the note" onClick={() => clearComposerNote(conversationId)}>
        <X size={12} />
      </button>
    </div>
  );
}
