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
import { Card, ErrorLine } from "./WorkspaceView";

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Workspace › Meetings (android round 7 C5 MeetingsScreen): scheduled meetings in the workspace's voice rooms. Joining
 * one joins its room's call. Invitees answer; the organizer or the room's managers change or cancel it; everyone
 * involved hears about changes live and gets a "starting soon" notification ten minutes before.
 */
export function MeetingsPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const rev = useOrbit((s) => s.meetingsRev);
  const community = useCommunityServer();
  const [tick, setTick] = useState(0);
  const meetings = useLoad(() => listMeetings(engine, orgId), [engine, orgId, tick, rev]);
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
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  return (
    <div className="ws-page">
      <Card
        title={community ? "Events" : "Meetings"}
        sub={`${community ? "Events happen in the community's" : "Meetings happen in the workspace's"} voice rooms: joining one joins its room. Titles and times are readable by the server, like a channel's name.`}
        actions={
          !guest && (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing("new")}>
              <Plus size={14} /> Schedule
            </button>
          )
        }
      >
        <ErrorLine text={meetings.error ?? act.error} />
        {meetings.data && upcoming.length === 0 && <p className="faint">No {community ? "events" : "meetings"} in the next 30 days.</p>}
        <ul className="ws-list">
          {upcoming.map((m) => (
            <li key={m.id} className="ws-row" style={{ alignItems: "flex-start" }}>
              <span className="lines grow">
                <strong>{m.title}</strong>
                <small>
                  {whenText(m.startsAt, m.endsAt, zone())}
                  {m.repeat === UNKNOWN ? " · repeats (set in a newer app)" : m.repeat ? ` · ${repeatLabel(m.repeat, m.startsAt, m.timeZone)}` : ""} · {m.room?.name ? `#${m.room.name}` : "room gone"}{" "}
                  · organized by {m.organizer.name ?? "someone"}
                </small>
                {m.description && <small className="faint">{m.description}</small>}
                <small className="faint">
                  {m.participants.length === 0 ? "Open to the room" : m.participants.map((p) => `${p.name ?? "someone"} (${RESPONSE_LABEL[p.response]?.toLowerCase() ?? p.response})`).join(", ")}
                </small>
                {m.myResponse && (
                  <span className="segmented" role="group" aria-label="Your answer" style={{ marginTop: 4 }}>
                    {RESPONSES.map((r) => (
                      <button key={r} aria-pressed={m.myResponse === r} disabled={act.busy} onClick={() => void act.act(() => respondToMeeting(engine, m.id, r).then(reload))}>
                        {RESPONSE_LABEL[r]}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              {m.room && (
                <button className="btn btn-secondary btn-sm" onClick={() => navigate({ section: "home", conversationId: m.room!.id })} title="Open the voice room">
                  <Headphones size={14} /> Room
                </button>
              )}
              <button className="icon-btn" aria-label="Add to my calendar" title="Add to my calendar (.ics)" onClick={() => calendar(m)}>
                <CalendarPlus size={16} />
              </button>
              {m.canEdit && (
                <>
                  <button className="icon-btn" aria-label={`Edit ${m.title}`} onClick={() => setEditing(m)}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn" aria-label={`Cancel ${m.title}`} disabled={act.busy} onClick={() => void act.act(() => cancelMeeting(engine, m.id).then(reload))}>
                    <X size={16} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {cancelled.length > 0 && <small className="faint">{cancelled.length === 1 ? "1 cancelled meeting" : `${cancelled.length} cancelled meetings`} not shown.</small>}
      </Card>
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
  const engine = useEngine();
  const rooms = useOrbit((s) => voiceRooms(s, orgId), shallowEqual);
  const community = useCommunityServer();
  const tz = meeting?.timeZone ?? zone();
  const [d0, t0, dur0] = meeting ? meetingFields(meeting.startsAt, meeting.endsAt, tz) : [...nextSlot(Date.now(), tz), 30];
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [roomId, setRoomId] = useState<string | null>(meeting?.room?.id ?? rooms[0]?.id ?? null);
  const [date, setDate] = useState(d0);
  const [time, setTime] = useState(t0);
  const [minutes, setMinutes] = useState<number>(dur0);
  const repeats = useOrbit((s) => s.server?.features.includes("event-repeat") ?? false);
  // null: a repeat this version can't read (a newer app's), kept as it is unless the person picks another.
  const [repeat, setRepeat] = useState<EventRepeatChoice | null>(meeting?.repeat === UNKNOWN ? null : (meeting?.repeat ?? "none"));
  const [people, setPeople] = useState<{ id: string; name: string }[]>(meeting?.participants.map((p) => ({ id: p.id, name: p.name ?? "someone" })) ?? []);
  const [q, setQ] = useState("");
  const found = useLoad(() => (q.trim().length >= 2 ? directory(engine, orgId, q) : Promise.resolve([])), [engine, orgId, q]);
  const act = useAction();
  const problems = meetingProblems(title, roomId, date, time, tz, Date.now());
  const save = () =>
    void act.act(async () => {
      const start = startMs(date, time, tz)!;
      const input = {
        roomId: roomId!,
        title: title.trim(),
        description: description.trim() || null,
        startsAt: start,
        endsAt: start + minutes * 60_000,
        timeZone: tz,
        participantIds: people.map((p) => p.id),
        ...(repeats && repeat !== null ? { repeat: repeat === "none" ? null : repeat } : {}),
      };
      await (meeting ? updateMeeting(engine, meeting.id, meeting.rev, input) : createMeeting(engine, orgId, input));
      onSaved();
    });
  return (
    <Dialog
      title={community ? (meeting ? "Edit event" : "Schedule an event") : meeting ? "Edit meeting" : "Schedule a meeting"}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={problems.length > 0 || act.busy} onClick={save}>
          {act.busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="dialog-body">
        <label className="field">
          <span>Title</span>
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly sync" />
        </label>
        <label className="field">
          <span>Voice room</span>
          <select className="input" value={roomId ?? ""} onChange={(e) => setRoomId(e.target.value || null)}>
            {rooms.length === 0 && <option value="">No voice rooms: make one in Channels</option>}
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="wf-row">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
          <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Length">
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        <small className="faint">Times are in {tz}.</small>
        {repeats && (
          <label className="field">
            <span>Repeats</span>
            <select className="input" value={repeat ?? UNKNOWN} onChange={(e) => setRepeat(e.target.value as EventRepeatChoice)}>
              {repeat === null && (
                <option value={UNKNOWN} disabled>
                  As set in a newer app
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
          <span>Notes (optional)</span>
          <textarea className="input" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="field">
          <span>Invite</span>
          <div className="wf-channels">
            {people.map((p) => (
              <span key={p.id} className="chip">
                {p.name}
                <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label={`Remove ${p.name}`} onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add people (they must be able to open the room)" aria-label="Find someone to invite" />
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
        {problems.length > 0 && (
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
