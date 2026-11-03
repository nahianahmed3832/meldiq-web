import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import type { CommunityPreview } from "../../api/communitySchemas";
import { useEngine } from "../../application/orbit";
import { setPrefs } from "../../application/prefs";
import { navigate } from "../../application/router";
import { applyToJoin, communityPreview, joinCommunity, withdrawApplication } from "../../sync/community";
import { members } from "../format";
import { Dialog } from "../components/Overlay";
import { OrgAvatar } from "../components/OrgAvatar";
import { usePhoto } from "../components/photos";
import { accentBand } from "./accent";
import { ChannelGlyph } from "./ChannelDialogs";
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
/**
 * A community before joining (COM-04, android DiscoverScreen's preview): the description, rules and the channels
 * everyone can see; then Join (open communities), Apply to join (with questions, batch B4b) or the note that it's
 * invite-only. The server checks bans, paused joining and the member limit. Opened from the Discover page.
 */
export function CommunityPreviewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [p, setP] = useState<CommunityPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const load = () =>
    communityPreview(engine, id)
      .then((x) => {
        setP(x);
        setAnswers((x.community.joinQuestions ?? []).map(() => ""));
      })
      .catch((e: unknown) => setError(errorText(e, uiText("organization.interface.couldn_t_load_this_community_18cc083"))));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads once per community
  }, [id]);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e, uiText("workspace.interface.that_didn_t_work_try_again_5da2573")));
    } finally {
      setBusy(false);
    }
  };
  const openIt = () => {
    setPrefs({ orgId: id });
    onClose();
    navigate({ section: "home" });
  };
  const c = p?.community;
  const questions = c?.joinQuestions ?? null;
  const app = p?.application ?? null;
  return (
    <Dialog title={c?.name ?? l10n("organization.community")} onClose={onClose} wide>
      <div className="dialog-body">
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {!p && !error && <span className="skeleton" style={{ height: 200 }} />}
        {p && c && (
          <>
            <PreviewBanner orgId={c.id} rev={c.bannerRev} accent={c.accent} />
            <div className="row" style={{ gap: 12 }}>
              <OrgAvatar orgId={c.id} name={c.name} photoRev={c.photoRev} size={56} />
              <div className="grow">
                <strong style={{ fontSize: 17 }}>{c.name}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  <Users size={13} aria-hidden /> {members(c.memberCount)}
                </div>
              </div>
            </div>
            {c.description && <p style={{ margin: 0 }}>{c.description}</p>}
            {c.rules && (
              <section className="card" style={{ padding: 12 }} aria-label={l10n("organization.rules_title")}>
                <h3 className="ws-subhead" style={{ marginTop: 0 }}>
                  {l10n("organization.rules_title")}
                </h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.rules}</p>
              </section>
            )}
            {p.channels.length > 0 && (
              <section aria-label={l10n("organization.channels")}>
                <h3 className="ws-subhead">
                  <Localized k="organization.interface.channels_everyone_can_see_55fb1d5" />
                </h3>
                <div className="chips">
                  {p.channels.slice(0, 20).map((ch) => (
                    <span key={ch.id} className="chip">
                      <ChannelGlyph kind={ch.kind} voice={ch.voice} format={ch.format} size={13} /> {ch.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {p.banned ? (
              <div className="banner danger">
                <Localized k="organization.interface.you_ve_been_banned_from_this_community_520f0f3" />
              </div>
            ) : p.joined ? (
              <button className="btn btn-primary" onClick={openIt}>
                <Localized k="organization.interface.open_community_1429f68" />
              </button>
            ) : c.invitesPausedUntil ? (
              <div className="banner info">
                <Localized k="organization.interface.this_community_has_paused_new_members_for_now_try_again_later_79d8170" />
              </div>
            ) : app?.status === "pending" ? (
              <div className="banner info" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="grow">
                  <Localized k="organization.interface.your_application_is_waiting_for_the_moderators_5adb989" />
                </span>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act(() => withdrawApplication(engine, app.id).then(load))}>
                  <Localized k="organization.interface.withdraw_application_f92a257" />
                </button>
              </div>
            ) : questions ? (
              applying ? (
                <form
                  style={{ display: "grid", gap: 10 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (answers.some((a) => !a.trim())) return setError(uiText("organization.interface.answer_every_question_b2763b7"));
                    void act(() => applyToJoin(engine, id, answers).then(load));
                    setApplying(false);
                  }}
                >
                  {questions.map((q, i) => (
                    <div key={i} className="field">
                      <label htmlFor={`ap-${i}`}>{q}</label>
                      <textarea
                        id={`ap-${i}`}
                        className="textarea"
                        rows={2}
                        maxLength={1000}
                        value={answers[i] ?? ""}
                        onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                      />
                    </div>
                  ))}
                  <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
                    <Localized k="organization.interface.the_community_s_moderators_read_your_answers_6d33b6b" />
                  </p>
                  <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setApplying(false)}>
                      {l10n("common.actions.cancel")}
                    </button>
                    <button className="btn btn-primary" disabled={busy}>
                      <Localized k="organization.interface.send_application_174b538" />
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {app?.status === "denied" && (
                    <div className="banner info">
                      <Localized k="organization.interface.your_last_application_wasn_t_accepted_you_can_apply_again_2d3f168" />
                    </div>
                  )}
                  <button className="btn btn-primary" onClick={() => setApplying(true)}>
                    {l10n("workspace.discover_apply")}
                  </button>
                </>
              )
            ) : c.joinPolicy === "open" ? (
              <button className="btn btn-primary" disabled={busy} onClick={() => void act(() => joinCommunity(engine, id).then(openIt))}>
                {busy ? l10n("workspace.discover_joining") : uiText("organization.interface.join_community_0468129")}
              </button>
            ) : (
              <div className="banner info">
                <Localized k="organization.interface.this_community_is_invite_only_ask_a_member_for_an_invitation_e3deea9" />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
/** The community's banner (API 0.44.0), or a band in its accent; nothing without either. */
function PreviewBanner({ orgId, rev, accent }: { orgId: string; rev: number | null; accent: string | null }) {
  useLocaleRender();
  const url = usePhoto("banner", orgId, rev);
  if (!url && !accent) return null;
  return <div className="preview-banner" style={url ? { backgroundImage: `url(${url})` } : { background: accentBand(accent ?? "") }} aria-hidden="true" />;
}
