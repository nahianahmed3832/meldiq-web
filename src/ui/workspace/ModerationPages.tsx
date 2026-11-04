import { countLabel } from "../../i18n/counts";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { Ban, Check, Minus, Plus, Shield, UserCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { answerApplication, applications, bans, setJoinQuestions, setSecurity, unban, updateCommunityAccess } from "../../sync/community";
import { PAUSE_CHOICES, running } from "../../sync/reports";
import { Toggle } from "../components/Toggle";
import { shortWhen, untilWhen } from "../format";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
import { VoiceBansCard } from "./VoiceBansCard";
import { PARITY_FEATURES } from "../../sync/communityParity";
const MAX_QUESTIONS = 5;
/**
 * Who can find and join the community, and its rules (COM-03, COM-08): listed in Discover or not, open or invite-only.
 * People who can edit the community change them; everyone sees them.
 */
export function AccessCard({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const can = detail.permissions.canManageOrg;
  const [rules, setRules] = useState(org.rules ?? "");
  useEffect(() => setRules(org.rules ?? ""), [org.rules]);
  const save = useAction();
  const change = (c: Parameters<typeof updateCommunityAccess>[2]) => void save.act(() => updateCommunityAccess(engine, org.id, c));
  return (
    <Card
      title={uiText("workspace.interface.access_and_rules_479486f")}
      sub={
        can
          ? uiText("workspace.interface.who_can_find_this_community_how_they_join_and_the_rules_shown_bef_c639267")
          : uiText("workspace.interface.only_people_who_can_edit_the_community_change_these_bbdf86e")
      }
    >
      <ErrorLine text={save.error} />
      <div className="field">
        <span className="label">
          <Localized k="organization.interface.who_can_find_it_df3ff14" />
        </span>
        <div className="segmented" role="radiogroup" aria-label={uiText("organization.interface.who_can_find_it_df3ff14")}>
          {(["private", "public"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={org.visibility === v}
              aria-pressed={org.visibility === v}
              disabled={!can || save.busy}
              onClick={() => change({ visibility: v, ...(v === "private" ? { joinPolicy: "invite" } : {}) })}
            >
              {v === "private" ? uiText("workspace.interface.only_people_with_an_invitation_9f30631") : uiText("organization.interface.listed_in_discover_39a6a3a")}
            </button>
          ))}
        </div>
      </div>
      {org.visibility === "public" && (
        <div className="field">
          <span className="label">
            <Localized k="organization.interface.who_can_join_35c6853" />
          </span>
          <div className="segmented" role="radiogroup" aria-label={uiText("organization.interface.who_can_join_35c6853")}>
            {(["invite", "open"] as const).map((v) => (
              <button key={v} role="radio" aria-checked={org.joinPolicy === v} aria-pressed={org.joinPolicy === v} disabled={!can || save.busy} onClick={() => change({ joinPolicy: v })}>
                {v === "invite" ? uiText("organization.interface.with_an_invitation_5a42cd4") : uiText("workspace.interface.anyone_from_discover_d93db23")}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="ac-rules">{l10n("organization.rules_title")}</label>
        <textarea
          id="ac-rules"
          className="textarea"
          rows={4}
          maxLength={2000}
          value={rules}
          disabled={!can}
          onChange={(e) => setRules(e.target.value)}
          placeholder={uiText("workspace.interface.be_kind_no_spam_5ce1744")}
        />
        <span className="hint">
          <Localized k="workspace.interface.shown_before_someone_joins_and_on_the_community_s_home_not_end_to_035473d" />
        </span>
      </div>
      {can && (
        <div>
          <button className="btn btn-primary btn-sm" disabled={save.busy || rules.trim() === (org.rules ?? "")} onClick={() => change({ rules: rules.trim() || null })}>
            <Localized k="workspace.interface.save_rules_e5dbdff" />
          </button>
        </div>
      )}
    </Card>
  );
}
/** Join questions (batch B4b): up to five questions people answer to apply; public communities only. */
export function JoinQuestionsCard({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const [qs, setQs] = useState<string[]>(org.joinQuestions ?? [""]);
  useEffect(() => setQs(org.joinQuestions ?? [""]), [org.joinQuestions]);
  const save = useAction();
  const clean = qs.map((q) => q.trim()).filter(Boolean);
  if (org.visibility !== "public") return null;
  return (
    <Card
      title={uiText("workspace.interface.join_questions_13d2c20")}
      sub={
        org.joinQuestions
          ? uiText("workspace.interface.native_count_4803ccbda", { value0: countLabel(org.joinQuestions.length, "questions"), value1: "" })
          : uiText("workspace.interface.off_people_join_the_usual_way_e393999")
      }
    >
      <p className="muted" style={{ margin: 0 }}>
        <Localized k="workspace.interface.ask_up_to_five_questions_people_answer_them_to_apply_and_moderato_d299f99" />
      </p>
      <ErrorLine text={save.error} />
      {qs.map((q, i) => (
        <div key={i} className="row" style={{ gap: 6 }}>
          <input
            className="input"
            aria-label={uiText("workspace.interface.question_value0_74865a9", { value0: i + 1 })}
            value={q}
            maxLength={200}
            placeholder={uiText("workspace.interface.question_value0_74865a9", { value0: i + 1 })}
            onChange={(e) => setQs(qs.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            className="icon-btn"
            aria-label={uiText("workspace.interface.remove_question_value0_3cde74b", { value0: i + 1 })}
            onClick={() => setQs(qs.length > 1 ? qs.filter((_, j) => j !== i) : [""])}
          >
            <Minus size={16} />
          </button>
        </div>
      ))}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {qs.length < MAX_QUESTIONS && (
          <button className="btn btn-secondary btn-sm" onClick={() => setQs([...qs, ""])}>
            <Localized k="workspace.interface.add_a_question_2727c61" slots={[<Plus size={14} />]} />
          </button>
        )}
        <button className="btn btn-primary btn-sm" disabled={save.busy || clean.length === 0} onClick={() => void save.act(() => setJoinQuestions(engine, org.id, clean))}>
          {l10n("common.actions.save")}
        </button>
        {org.joinQuestions && (
          <button className="btn btn-ghost btn-sm" disabled={save.busy} onClick={() => void save.act(() => setJoinQuestions(engine, org.id, null))}>
            <Localized k="workspace.interface.turn_off_applications_97e71a7" />
          </button>
        )}
      </div>
    </Card>
  );
}
/** Security actions (batch B4, MOD-13; B4b activity alerts): pause joining or new DMs between members for a while. */
export function SecurityPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const engine = useEngine();
  const org = useOrbit((s) => s.orgs.find((o) => o.id === detail.org.id)) ?? detail.org;
  const alerts = useOrbit((s) => s.server?.features.includes("activity-alerts") ?? false);
  const act = useAction();
  const row = (key: "invitesPausedUntil" | "dmsPausedUntil", title: string, sub: string) => {
    const until = org[key];
    return (
      <Card title={title} sub={sub}>
        {running(until) ? (
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="tag warn">
              <Localized k="workspace.interface.paused_until_9c89619" slots={[untilWhen(until!)]} />
            </span>
            <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => setSecurity(engine, org.id, { [key]: null }))}>
              <Localized k="messaging.interface.resume_d640c74" />
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {PAUSE_CHOICES.map((c) => (
              <button key={c.ms} className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => void act.act(() => setSecurity(engine, org.id, { [key]: Date.now() + c.ms }))}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </Card>
    );
  };
  return (
    <div className="ws-page">
      {org.activityAlert && (
        <div className="banner warn" role="status">
          <Localized k="workspace.interface.people_joined_within_10_minutes_check_that_it_s_expected_4a8fece" slots={[<Shield size={16} />, org.activityAlert.count]} />
        </div>
      )}
      <ErrorLine text={act.error} />
      {row("invitesPausedUntil", uiText("workspace.interface.pause_joining_2d41c2c"), uiText("workspace.interface.nobody_can_join_by_invitation_or_openly_until_the_pause_ends_6b834dc"))}
      {row("dmsPausedUntil", uiText("workspace.interface.pause_new_dms_abd414a"), uiText("workspace.interface.members_can_t_start_new_direct_conversations_with_each_other_exis_0bd7f2f"))}
      {alerts && (
        <Card title={uiText("workspace.interface.activity_alerts_b1d511f")}>
          <div className="setting">
            <span className="lines">
              <strong>
                <Localized k="workspace.interface.tell_moderators_when_many_people_join_at_once_48d1843" />
              </strong>
              <small>
                <Localized k="workspace.interface.10_or_more_joins_within_10_minutes_nothing_is_paused_automaticall_915db85" />
              </small>
            </span>
            <Toggle
              checked={org.activityAlerts}
              onChange={(on) => void act.act(() => setSecurity(engine, org.id, { activityAlerts: on }))}
              label={uiText("workspace.interface.activity_alerts_b1d511f")}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
/** Bans (MOD-05): who can't come back until unbanned. Banning is done from a member's row in Members. */
export function BansPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const engine = useEngine();
  const [rev, setRev] = useState(0);
  const list = useLoad(() => bans(engine, detail.org.id), [engine, detail.org.id, rev]);
  const act = useAction();
  const voice = useOrbit((s) => s.server?.features.includes(PARITY_FEATURES.safety) ?? false);
  return (
    <div className="ws-page">
      <Card
        title={list.data ? uiText("workspace.interface.bans_value0_84bf98d", { value0: list.data.length }) : uiText("workspace.interface.bans_4d5469c")}
        sub={uiText("workspace.interface.banned_people_can_t_come_back_by_invitation_or_from_discover_unti_3acbfab")}
      >
        <ErrorLine text={list.error ?? act.error} />
        <ul className="ws-list" aria-busy={list.loading}>
          {(list.data ?? []).map((b) => (
            <li key={b.userId} className="ws-row">
              <Ban size={16} className="faint" />
              <span className="lines grow">
                <span className="ellipsis">
                  {b.displayName} <span className="faint">@{b.username}</span>
                </span>
                <small className="ellipsis">
                  <Localized
                    k="workspace.interface.banned_373de90"
                    slots={[
                      shortWhen(b.bannedAt),
                      b.bannedByName ? uiText("workspace.interface.by_value0_943cd46", { value0: b.bannedByName }) : "",
                      b.reason ? uiText("calls.interface.value0_9402340", { value0: b.reason }) : "",
                    ]}
                  />
                </small>
              </span>
              <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => unban(engine, detail.org.id, b.userId).then(() => setRev((r) => r + 1)))}>
                <Localized k="workspace.interface.lift_ban_b5014ae" />
              </button>
            </li>
          ))}
          {list.data?.length === 0 && (
            <li className="faint">
              <Localized k="workspace.interface.nobody_is_banned_peaceful_b595d72" />
            </li>
          )}
        </ul>
      </Card>
      {voice && <VoiceBansCard orgId={detail.org.id} />}
    </div>
  );
}
/** Applications (batch B4b): Waiting and Answered; Let in or Decline, each with an optional note for other moderators. */
export function ApplicationsPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const rev = useOrbit((s) => s.moderationRev);
  const [tab, setTab] = useState<"pending" | "closed">("pending");
  const [tick, setTick] = useState(0);
  const list = useLoad(() => applications(engine, detail.org.id, tab), [engine, detail.org.id, tab, rev, tick]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = useAction();
  const answer = (id: string, status: "approved" | "denied") => void act.act(() => answerApplication(engine, id, status, notes[id] ?? null).then(() => setTick((t) => t + 1)));
  return (
    <div className="ws-page">
      <div className="segmented" role="tablist" aria-label={uiText("workspace.interface.applications_98e33b0")}>
        <button role="tab" aria-selected={tab === "pending"} onClick={() => setTab("pending")}>
          <Localized k="workspace.interface.waiting_948532a" slots={[list.data && tab === "pending" ? uiText("workspace.interface.value0_c9bd7bc", { value0: list.data.pending }) : ""]} />
        </button>
        <button role="tab" aria-selected={tab === "closed"} onClick={() => setTab("closed")}>
          <Localized k="workspace.interface.answered_6655903" />
        </button>
      </div>
      <ErrorLine text={list.error ?? act.error} />
      {(list.data?.applications ?? []).map((a) => (
        <Card
          key={a.id}
          title={a.user.displayName ?? l10n("messaging.react_someone")}
          sub={uiText("workspace.interface.value0_applied_value1_d9392c9", { value0: a.user.username ?? uiText("workspace.interface.unknown_50d8b4a"), value1: shortWhen(a.createdAt) })}
        >
          <dl className="answers">
            {a.questions.map((q, i) => (
              <div key={i}>
                <dt>{q}</dt>
                <dd>{a.answers[i] ?? ""}</dd>
              </div>
            ))}
          </dl>
          {a.status === "pending" ? (
            <>
              <input
                className="input"
                aria-label={uiText("workspace.interface.note_for_the_other_moderators_436b310")}
                placeholder={uiText("workspace.interface.note_for_the_other_moderators_optional_fc9de58")}
                maxLength={300}
                value={notes[a.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
              />
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={act.busy} onClick={() => answer(a.id, "approved")}>
                  <Localized k="workspace.interface.let_in_dac9107" slots={[<UserCheck size={14} />]} />
                </button>
                <button className="btn btn-secondary btn-sm" disabled={act.busy} onClick={() => answer(a.id, "denied")}>
                  <X size={14} /> {l10n("calls.decline")}
                </button>
              </div>
            </>
          ) : (
            <p className="faint" style={{ margin: 0 }}>
              {a.status === "approved" ? <Check size={13} /> : null}{" "}
              {a.status === "approved"
                ? uiText("workspace.interface.let_in_by_value0_3bc40d8", { value0: a.handledByName ?? uiText("workspace.interface.a_moderator_7858d92") })
                : a.status === "denied"
                  ? uiText("workspace.interface.declined_by_value0_5dc71e2", { value0: a.handledByName ?? uiText("workspace.interface.a_moderator_7858d92") })
                  : a.status === "withdrawn"
                    ? uiText("workspace.interface.withdrawn_00c0b03")
                    : uiText("workspace.interface.status_set_in_a_newer_version_of_meldiq_bd0cc8a")}
              {a.note ? uiText("calls.interface.value0_9402340", { value0: a.note }) : ""}
            </p>
          )}
        </Card>
      ))}
      {list.data?.applications.length === 0 && (
        <p className="faint">{tab === "pending" ? uiText("workspace.interface.no_one_is_waiting_4c6c5a8") : uiText("workspace.interface.nothing_answered_yet_45f3955")}</p>
      )}
    </div>
  );
}
