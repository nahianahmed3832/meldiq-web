import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { CalendarPlus, Headphones, Pencil, Plus, X } from "lucide-react";
import { UNKNOWN } from "../../api/enums";
import { EVENT_REPEATS, type EventRepeatChoice, repeatLabel } from "../../sync/workspaceC5";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { shallowEqual, useCommunityServer, useEngine, useOrbit } from "../../application/orbit";
import { navigate } from "../../application/router";
import {
  cancelMeeting,
  createMeeting,
  DURATIONS,
  listMeetings,
  type Meeting,
  meetingFields,
  meetingIcs,
  eventStepReady,
  meetingProblems,
  nextSlot,
  respondToMeeting,
  RESPONSE_LABEL,
  RESPONSES,
  startMs,
  updateMeeting,
  whenText,
} from "../../sync/workspaceC5";
import { directory } from "../../sync/workspaces";
import { voiceRooms } from "../selectors";
import { Dialog } from "../components/Overlay";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "../components/SettingsCard";
import { EventCover } from "./EventCover";
const l10nCancel = () => uiText("workspace.part3.confirmCancel");
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/**
 * Workspace › Meetings (android round 7 C5 MeetingsScreen): scheduled meetings in the workspace's voice rooms. Joining
 * one joins its room's call. Invitees answer; the organizer or the room's managers change or cancel it; everyone
 * involved hears about changes live and gets a "starting soon" notification ten minutes before.
 */
export function MeetingsPage({ detail }: { detail: OrgAdminDetail }) {
  useLocaleRender();
  const engine = useEngine();
  const orgId = detail.org.id;
  const rev = useOrbit((s) => s.meetingsRev);
  const community = useCommunityServer();
  const scopedEvents = useOrbit((s) => s.server?.features.includes("event-occurrence-scope") ?? false);
  const [tick, setTick] = useState(0);
  const meetings = useLoad(() => listMeetings(engine, orgId), [engine, orgId, tick, rev]);
  const [cancelling, setCancelling] = useState<Meeting | null>(null);
  const [cancelScope, setCancelScope] = useState<"occurrence" | "series">("occurrence");
  const [editing, setEditing] = useState<Meeting | "new" | null>(null);
  const act = useAction();
  const reload = () => setTick((t) => t + 1);
  const guest = detail.org.myRole === "GUEST";
  const upcoming = (meetings.data ?? []).filter((m) => !m.cancelled).sort((a, b) => a.startsAt - b.startsAt);
  const cancelled = (meetings.data ?? []).filter((m) => m.cancelled);
  const calendar = (m: Meeting) => {
    const url = URL.createObjectURL(new Blob([meetingIcs(m)], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.title.replace(/[^\p{L}\p{N} ._-]+/gu, "").trim() || "meeting"}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  return (
    <div className="ws-page">
      <Card
        title={community ? uiText("workspace.interface.events_8d14f6e") : uiText("workspace.interface.meetings_bca705b")}
        sub={uiText("workspace.interface.value0_voice_rooms_joining_one_joins_its_room_titles_and_times_ar_45cbbf2", {
          value0: community ? uiText("workspace.interface.events_happen_in_the_community_s_3c7342e") : uiText("workspace.interface.meetings_happen_in_the_community_s_a82460e"),
        })}
        actions={
          !guest && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
              <Localized k="workspace.interface.schedule_970ceab" slots={[<Plus size={14} />]} />
            </button>
          )
        }
      >
        <ErrorLine text={meetings.error ?? act.error} />
        {meetings.data && upcoming.length === 0 && (
          <p className="faint">
            <Localized k="workspace.interface.no_in_the_next_30_days_d54dc26" slots={[community ? uiText("workspace.interface.events_862417b") : uiText("workspace.interface.meetings_f7f1aed")]} />
          </p>
        )}
        <ul className="ws-list">
          {upcoming.map((m) => (
            <li key={m.id} className="ws-row" style={{ alignItems: "flex-start" }}>
              <span className="lines grow">
                <strong>{m.title}</strong>
                <EventCover meeting={m} onChanged={reload} />
                <small>
                  <Localized
                    k="workspace.interface.organized_by_5848390"
                    slots={[
                      whenText(m.startsAt, m.endsAt, zone()),
                      m.repeat === UNKNOWN
                        ? uiText("workspace.interface.repeats_set_in_a_newer_app_cc0c9cf")
                        : m.repeat
                          ? uiText("calls.interface.value0_9402340", { value0: repeatLabel(m.repeat, m.startsAt, m.timeZone) })
                          : "",
                      m.externalLocation ?? (m.room?.name ? uiText("messaging.interface.value0_dbac6f0", { value0: m.room.name }) : uiText("workspace.interface.room_gone_25cbd16")),
                      m.organizer.name ?? uiText("workspace.interface.someone_2a59d59"),
                    ]}
                  />
                </small>
                {m.description && <small className="faint">{m.description}</small>}
                <small className="faint">
                  {m.participants.length === 0
                    ? uiText("workspace.interface.open_to_the_room_54eadbf")
                    : m.participants.map((p) => `${p.name ?? "someone"} (${RESPONSE_LABEL[p.response]?.toLowerCase() ?? p.response})`).join(", ")}
                </small>
                {m.myResponse && (
                  <span className="segmented" role="group" aria-label={uiText("workspace.interface.your_answer_d0e869b")} style={{ marginTop: 4 }}>
                    {RESPONSES.map((r) => (
                      <button key={r} aria-pressed={m.myResponse === r} disabled={act.busy} onClick={() => void act.act(() => respondToMeeting(engine, m.id, r, m.rev).then(reload))}>
                        {RESPONSE_LABEL[r]}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              {m.room && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate({ section: "home", conversationId: m.room!.id })}
                  title={uiText("workspace.interface.open_the_voice_room_1d483cf")}
                >
                  <Localized k="workspace.interface.room_ffbb624" slots={[<Headphones size={14} />]} />
                </button>
              )}
              <button
                className="icon-btn"
                aria-label={uiText("workspace.interface.add_to_my_calendar_9d60f91")}
                title={uiText("workspace.interface.add_to_my_calendar_ics_b25f764")}
                onClick={() => calendar(m)}
              >
                <CalendarPlus size={16} />
              </button>
              {m.canEdit && (
                <>
                  <button className="icon-btn" aria-label={uiText("settings.interface.edit_value0_44b87fe", { value0: m.title })} onClick={() => setEditing(m)}>
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={uiText("workspace.interface.cancel_value0_e3e84f0", { value0: m.title })}
                    disabled={act.busy}
                    onClick={() => {
                      setCancelScope("occurrence");
                      setCancelling(m);
                    }}
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {cancelled.length > 0 && (
          <small className="faint">
            <Localized
              k="workspace.interface.not_shown_38301bd"
              slots={[
                cancelled.length === 1 ? uiText("workspace.interface.1_cancelled_meeting_ed2402b") : uiText("workspace.interface.value0_cancelled_meetings_3e18cc5", { value0: cancelled.length }),
              ]}
            />
          </small>
        )}
      </Card>
      {cancelling && (
        <Dialog
          title={uiText("workspace.part3.cancelEvent")}
          onClose={() => setCancelling(null)}
          footer={
            <button
              className="btn btn-danger"
              disabled={act.busy}
              onClick={() =>
                void act.act(async () => {
                  await cancelMeeting(engine, cancelling.id, cancelling.repeat && scopedEvents ? cancelScope : "series", cancelling.rev);
                  setCancelling(null);
                  reload();
                })
              }
            >
              {l10nCancel()}
            </button>
          }
        >
          <p>{cancelling.title}</p>
          <ErrorLine text={act.error} />
          {cancelling.repeat && scopedEvents && (
            <label className="field">
              <span>{uiText("workspace.part3.changeScope")}</span>
              <select className="input" value={cancelScope} onChange={(e) => setCancelScope(e.target.value as "occurrence" | "series")}>
                <option value="occurrence">{uiText("workspace.part3.thisOccurrence")}</option>
                <option value="series">{uiText("workspace.part3.currentAndFuture")}</option>
              </select>
            </label>
          )}
        </Dialog>
      )}
      {editing && (
        <MeetingDialog
          orgId={orgId}
          meeting={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
function MeetingDialog({ orgId, meeting, onClose, onSaved }: { orgId: string; meeting: Meeting | null; onClose: () => void; onSaved: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const internalRooms = useOrbit((s) => voiceRooms(s, orgId), shallowEqual);
  const allChannels = useOrbit((s) => Object.values(s.conversations).filter((c) => c.type === "CHANNEL" && c.orgId === orgId && c.joined && !c.archived), shallowEqual);
  const scopedSupported = useOrbit((s) => s.server?.features.includes("event-occurrence-scope") ?? false);
  const externalSupported = useOrbit((s) => s.server?.features.includes("event-external-location") ?? false);
  const [external, setExternal] = useState(!!meeting?.externalLocation);
  const [externalLocation, setExternalLocation] = useState(meeting?.externalLocation ?? "");
  const [scope, setScope] = useState<"occurrence" | "series">(scopedSupported ? "occurrence" : "series");
  const rooms = external ? allChannels : internalRooms;
  const community = useCommunityServer();
  const tz = meeting?.timeZone ?? zone();
  const [d0, t0, dur0] = meeting ? meetingFields(meeting.startsAt, meeting.endsAt, tz) : [...nextSlot(Date.now(), tz), 30];
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [roomId, setRoomId] = useState<string | null>(meeting?.visibilityChannel?.id ?? meeting?.room?.id ?? rooms[0]?.id ?? null);
  const [date, setDate] = useState(d0);
  const [time, setTime] = useState(t0);
  const [minutes, setMinutes] = useState<number>(dur0);
  const repeats = useOrbit((s) => s.server?.features.includes("event-repeat") ?? false);
  // null: a repeat this version can't read (a newer app's), kept as it is unless the person picks another.
  const [repeat, setRepeat] = useState<EventRepeatChoice | null>(meeting?.repeat === UNKNOWN ? null : (meeting?.repeat ?? "none"));
  const [people, setPeople] = useState<
    {
      id: string;
      name: string;
    }[]
  >(meeting?.participants.map((p) => ({ id: p.id, name: p.name ?? "someone" })) ?? []);
  const [q, setQ] = useState("");
  const found = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const act = useAction();
  const [step, setStep] = useState(0);
  const problems = meetingProblems(title, roomId, date, time, tz, Date.now());
  if (external && !externalLocation.trim()) problems.push(uiText("workspace.part3.locationRequired"));
  const save = () =>
    void act.act(async () => {
      const start = startMs(date, time, tz)!;
      const input = {
        roomId: roomId!,
        ...(externalSupported ? { externalLocation: external ? externalLocation.trim() : null } : {}),
        ...(meeting?.repeat ? { scope } : {}),
        title: title.trim(),
        description: description.trim() || null,
        startsAt: start,
        endsAt: start + minutes * 60000,
        timeZone: tz,
        participantIds: people.map((p) => p.id),
        ...(repeats && repeat !== null ? { repeat: repeat === "none" ? null : repeat } : {}),
      };
      await (meeting ? updateMeeting(engine, meeting.id, meeting.rev, input) : createMeeting(engine, orgId, input));
      onSaved();
    });
  // Android B5: a new event in three steps (where, then what and when, then a preview card); editing shows them together.
  const stepped = !meeting;
  const ready = eventStepReady(step, roomId, problems) && (!external || !!externalLocation.trim());
  const start = startMs(date, time, tz);
  const where = (
    <>
      {externalSupported && (
        <label className="field">
          <span>{uiText("workspace.part3.locationType")}</span>
          <select
            className="input"
            value={external ? "external" : "voice"}
            onChange={(e) => {
              const next = e.target.value === "external";
              setExternal(next);
              const available = next ? allChannels : internalRooms;
              if (!available.some((c) => c.id === roomId)) setRoomId(available[0]?.id ?? null);
            }}
          >
            <option value="voice">{uiText("calls.interface.voice_room_aa0cfa3")}</option>
            <option value="external">{uiText("workspace.part3.externalLocation")}</option>
          </select>
        </label>
      )}
      {external && (
        <label className="field">
          <span>{uiText("workspace.part3.externalLocation")}</span>
          <input className="input" aria-label={uiText("workspace.part3.externalLocation")} maxLength={500} value={externalLocation} onChange={(e) => setExternalLocation(e.target.value)} />
          <small>{uiText("workspace.part3.externalHelp")}</small>
        </label>
      )}
      {meeting?.repeat && scopedSupported && (
        <label className="field">
          <span>{uiText("workspace.part3.changeScope")}</span>
          <select className="input" aria-label={uiText("workspace.part3.changeScope")} value={scope} onChange={(e) => setScope(e.target.value as "occurrence" | "series")}>
            <option value="occurrence">{uiText("workspace.part3.thisOccurrence")}</option>
            <option value="series">{uiText("workspace.part3.currentAndFuture")}</option>
          </select>
          <small>{uiText("workspace.part3.scopeHelp")}</small>
        </label>
      )}
      <label className="field">
        <span>{external ? uiText("workspace.part3.visibilityChannel") : <Localized k="calls.interface.voice_room_aa0cfa3" />}</span>
        <select className="input" value={roomId ?? ""} onChange={(e) => setRoomId(e.target.value || null)}>
          {rooms.length === 0 && (
            <option value="">
              <Localized k="workspace.interface.no_voice_rooms_make_one_in_channels_b2b178b" />
            </option>
          )}
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              #{r.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  const what = (
    <>
      <label className="field">
        <span>
          <Localized k="messaging.interface.title_7e8cd20" />
        </span>
        <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={uiText("workspace.interface.e_g_weekly_sync_e1380f5")} />
      </label>
      <div className="wf-row">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={uiText("workspace.interface.date_99c40ab")} />
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={uiText("workspace.interface.time_33b9347")} />
        <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label={uiText("workspace.interface.length_adc9560")}>
          {DURATIONS.map((m) => (
            <option key={m} value={m}>
              <Localized k="workspace.interface.min_6a0d62a" slots={[m]} />
            </option>
          ))}
        </select>
      </div>
      <small className="faint">
        <Localized k="workspace.interface.times_are_in_b37c033" slots={[tz]} />
      </small>
      {repeats && (
        <label className="field">
          <span>
            <Localized k="workspace.interface.repeats_92ee023" />
          </span>
          <select className="input" value={repeat ?? UNKNOWN} disabled={!!meeting?.repeat && scope === "occurrence"} onChange={(e) => setRepeat(e.target.value as EventRepeatChoice)}>
            {repeat === null && (
              <option value={UNKNOWN} disabled>
                <Localized k="workspace.interface.as_set_in_a_newer_app_431a150" />
              </option>
            )}
            {EVENT_REPEATS.map((r) => (
              <option key={r} value={r}>
                {repeatLabel(r, startMs(date, time, tz) ?? Date.now(), tz)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>
          <Localized k="settings.interface.notes_optional_6239b93" />
        </span>
        <textarea className="input" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="field">
        <span>
          <Localized k="workspace.interface.invite_1fd9ae1" />
        </span>
        <div className="wf-channels">
          {people.map((p) => (
            <span key={p.id} className="chip">
              {p.name}
              <button
                className="icon-btn"
                style={{ width: 18, height: 18 }}
                aria-label={uiText("messaging.interface.remove_value0_3028bf7", { value0: p.name })}
                onClick={() => setPeople(people.filter((x) => x.id !== p.id))}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={uiText("workspace.interface.add_people_they_must_be_able_to_open_the_room_bfff733")}
          aria-label={uiText("workspace.interface.find_someone_to_invite_55e8f2d")}
        />
        <ul className="ws-list">
          {(found.data ?? [])
            .filter((p) => !people.some((x) => x.id === p.id))
            .slice(0, 6)
            .map((p) => (
              <li key={p.id}>
                <button
                  className="list-row"
                  onClick={() => {
                    setPeople([...people, { id: p.id, name: p.displayName }]);
                    setQ("");
                  }}
                >
                  {p.displayName} <small className="faint">@{p.username}</small>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </>
  );
  const preview = (
    <div className="event-preview card" aria-label={uiText("organization.interface.preview_324b134")}>
      <small className="faint">
        <Localized k="workspace.interface.preview_7f7f280" slots={[community ? uiText("workspace.interface.event_4e1f49a") : uiText("workspace.interface.meeting_8b8b887")]} />
      </small>
      <strong className="event-preview-title">{title.trim() || uiText("workspace.interface.untitled_f59ab8d")}</strong>
      <span>{start !== null ? whenText(start, start + minutes * 60000, tz) : ""}</span>
      <span className="row" style={{ gap: 6 }}>
        <Headphones size={14} />{" "}
        {external ? `${uiText("workspace.part3.externalLocation")}: ${externalLocation}` : `#${rooms.find((r) => r.id === roomId)?.name ?? uiText("workspace.interface.room_1f1c5b2")}`}
      </span>
      {repeat && repeat !== "none" && start !== null && <span>{repeatLabel(repeat, start, tz)}</span>}
      {description.trim() && (
        <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {description.trim()}
        </p>
      )}
      {people.length > 0 && (
        <span className="faint">
          <Localized k="workspace.interface.invited_d384544" slots={[people.map((p) => p.name).join(", ")]} />
        </span>
      )}
    </div>
  );
  const STEP_TITLES = [uiText("workspace.interface.where_1daaa38"), uiText("workspace.interface.what_and_when_a3ab27c"), uiText("organization.interface.preview_324b134")];
  return (
    <Dialog
      title={
        community
          ? meeting
            ? uiText("workspace.interface.edit_event_a5eca6b")
            : uiText("workspace.interface.schedule_an_event_5c4c0b2")
          : meeting
            ? uiText("workspace.interface.edit_meeting_fa4d803")
            : uiText("workspace.interface.schedule_a_meeting_b566179")
      }
      onClose={onClose}
      footer={
        stepped && step < 2 ? (
          <>
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                {l10n("common.actions.back")}
              </button>
            )}
            <button className="btn btn-primary" disabled={!ready} onClick={() => setStep(step + 1)}>
              {l10n("common.actions.next")}
            </button>
          </>
        ) : (
          <>
            {stepped && (
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                {l10n("common.actions.back")}
              </button>
            )}
            <button className="btn btn-primary" disabled={problems.length > 0 || act.busy} onClick={save}>
              {act.busy
                ? l10n("common.common_saving")
                : stepped
                  ? community
                    ? uiText("organization.interface.create_event_946cbe2")
                    : uiText("workspace.interface.create_meeting_68e8ab7")
                  : l10n("common.actions.save")}
            </button>
          </>
        )
      }
    >
      <div className="dialog-body">
        {stepped && (
          <ol className="event-steps" aria-label={uiText("workspace.interface.steps_1de3df7")}>
            {STEP_TITLES.map((t, i) => (
              <li key={t} aria-current={i === step ? "step" : undefined} className={i < step ? "done" : undefined}>
                {t}
              </li>
            ))}
          </ol>
        )}
        {!stepped ? (
          <>
            {what}
            {where}
          </>
        ) : step === 0 ? (
          where
        ) : step === 1 ? (
          what
        ) : (
          preview
        )}
        {(!stepped || step === 1) && problems.length > 0 && (
          <ul className="wf-problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <ErrorLine text={act.error} />
      </div>
    </Dialog>
  );
}
