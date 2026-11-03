import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { ShieldBan } from "lucide-react";
import { UNKNOWN } from "../../api/enums";
import { useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { DM_POLICIES, DM_POLICY_LABEL, type DmPolicy, messagingSettings, REQUEST_POLICIES, REQUEST_POLICY_LABEL, type RequestPolicy, setMessagingSettings } from "../../sync/social";
import { type Audience, AUDIENCES, blockedIds, myProfile, type Privacy, type PrivacyField, setPrivacy, unblock } from "../../sync/profile";
import { userProfile } from "../../sync/account";
import { useAction, useLoad } from "../workspace/useLoad";
import { GroupAndSuggestRows } from "./PrivacyExtras";
const FIELDS: {
  field: PrivacyField;
  label: string;
  help: string;
}[] = [
  {
    field: "photo",
    get label() {
      return uiText("settings.interface.profile_photo_ac8a731");
    },
    get help() {
      return uiText("settings.interface.stored_on_meldiq_s_servers_like_your_messages_16ae619");
    },
  },
  {
    field: "bio",
    get label() {
      return uiText("settings.interface.bio_3933b18");
    },
    help: "",
  },
  {
    field: "name",
    get label() {
      return uiText("settings.interface.first_and_last_name_25c5a0f");
    },
    help: "",
  },
  {
    field: "birthday",
    get label() {
      return uiText("settings.interface.birthday_c6138ab");
    },
    help: "",
  },
  {
    field: "phone",
    get label() {
      return uiText("settings.interface.phone_number_306f1bb");
    },
    help: "",
  },
  {
    field: "lastSeen",
    get label() {
      return uiText("settings.interface.online_and_last_seen_f9f3e3e");
    },
    get help() {
      return uiText("settings.interface.also_hides_you_from_presence_updates_4e08ee9");
    },
  },
  {
    field: "findByPhone",
    get label() {
      return uiText("settings.interface.find_me_by_phone_number_be42192");
    },
    get help() {
      return uiText("settings.interface.exact_number_only_never_a_list_6182535");
    },
  },
  {
    field: "findByUsername",
    get label() {
      return uiText("settings.interface.find_me_by_username_8352356");
    },
    get help() {
      return uiText("settings.interface.my_contacts_also_hides_you_from_other_servers_lookups_0f731ed");
    },
  },
];
const AUDIENCE_LABEL: Record<Audience, string> = {
  get everyone() {
    return uiText("workspace.interface.everyone_da2e5dc");
  },
  get contacts() {
    return uiText("settings.interface.my_contacts_6add592");
  },
  get nobody() {
    return uiText("workspace.interface.nobody_3fad99b");
  },
};
/** Who sees each part of the profile (server/src/profile.ts enforces it), and the people this account has blocked. */
export function PrivacySettings() {
  useLocaleRender();
  const engine = useEngine();
  const profile = useLoad(() => myProfile(engine), [engine]);
  const [privacy, setLocal] = useState<Partial<Privacy> | null>(null);
  const act = useAction();
  const current = privacy ?? profile.data?.privacy ?? null;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>
        <Localized k="settings.interface.who_can_see_your_profile_49f5474" />
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <Localized k="settings.interface.my_contacts_are_people_you_share_a_conversation_with_or_a_communi_6b03f2b" />
      </p>
      {(profile.error || act.error) && (
        <div className="banner danger" role="alert">
          {profile.error ?? act.error}
        </div>
      )}
      <div style={{ display: "grid", gap: 2 }}>
        {FIELDS.map((f) => (
          <div key={f.field} className="ws-row">
            <span className="lines grow">
              <span>{f.label}</span>
              {f.help && <small>{f.help}</small>}
            </span>
            <select
              className="input input-sm"
              aria-label={f.label}
              disabled={!current || act.busy}
              value={current?.[f.field] ?? "everyone"}
              onChange={(e) => {
                const value = e.target.value as Audience;
                void act.act(async () => setLocal(await setPrivacy(engine, { [f.field]: value })));
              }}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
export function BlockedPeople() {
  useLocaleRender();
  const engine = useEngine();
  const [version, setVersion] = useState(0);
  const list = useLoad(async () => {
    const ids = await blockedIds(engine);
    return Promise.all(
      ids.map(async (id) => ({
        id,
        name: await userProfile(engine, id).then(
          (u) => `${u.displayName} (@${u.username})`,
          () => uiText("messaging.react_someone"),
        ),
      })),
    );
  }, [engine, version]);
  const act = useAction();
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>
        <Localized k="settings.interface.blocked_people_21c150a" slots={[<ShieldBan size={16} style={{ verticalAlign: "-3px" }} />]} />
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <Localized k="settings.interface.they_see_only_your_username_display_name_and_colour_block_someone_6d342dc" />
      </p>
      {act.error && <div className="banner danger">{act.error}</div>}
      <ul className="ws-list" aria-label={uiText("settings.interface.blocked_people_e11bdf7")} aria-busy={list.loading}>
        {(list.data ?? []).map((b) => (
          <li key={b.id} className="ws-row">
            <span className="grow ellipsis">{b.name}</span>
            <button className="btn btn-ghost btn-sm" disabled={act.busy} onClick={() => void act.act(() => unblock(engine, b.id).then(() => setVersion((v) => v + 1)))}>
              <Localized k="messaging.interface.unblock_712da63" />
            </button>
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="faint">
            <Localized k="settings.interface.nobody_f1908ed" />
          </li>
        )}
      </ul>
    </div>
  );
}
/**
 * Who can message you (batch B6, android MessagingPrivacy): directly, or as a message request you answer first. Blocked
 * and unknown people get the same answer, so a setting never reveals a block. API 0.65.0 adds who may add you to group
 * chats and whether you're suggested to people you share communities with (PrivacyExtras), on the same settings.
 */
export function MessagingSettings() {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const requests = useOrbit((s) => s.server?.features.includes("message-requests") ?? false);
  const groupAdd = useOrbit((s) => s.server?.features.includes("group-add-policy") ?? false);
  const suggest = useOrbit((s) => s.server?.features.includes("suggested-people") ?? false);
  const offered = requests || groupAdd || suggest;
  const loaded = useLoad(() => (offered ? messagingSettings(engine) : Promise.resolve(null)), [engine, offered]);
  const [local, setLocal] = useState<Awaited<ReturnType<typeof messagingSettings>> | null>(null);
  const act = useAction();
  const s = local ?? loaded.data;
  if (!offered) return null;
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>{requests ? l10n("workspace.nav_messages") : uiText("settings.interface.groups_and_suggestions_a1fdb1a")}</h3>
      {(loaded.error || act.error) && (
        <div className="banner danger" role="alert">
          {loaded.error ?? act.error}
        </div>
      )}
      {requests && (
        <>
          <div className="ws-row">
            <span className="lines grow">
              <span>
                <Localized k="settings.interface.who_can_message_you_directly_1dace85" />
              </span>
              <small>
                <Localized k="settings.interface.others_can_send_you_a_message_request_which_arrives_without_a_not_9541b6e" />
              </small>
            </span>
            <select
              className="input input-sm"
              aria-label={uiText("settings.interface.who_can_message_you_directly_1dace85")}
              disabled={!s || act.busy}
              value={s?.dmPolicy ?? "everyone"}
              onChange={(e) => void act.act(async () => setLocal(await setMessagingSettings(engine, { dmPolicy: e.target.value as DmPolicy })))}
            >
              {s?.dmPolicy === UNKNOWN && (
                <option value={UNKNOWN} disabled>
                  <Localized k="settings.interface.set_in_a_newer_version_of_meldiq_57dfd6c" />
                </option>
              )}
              {DM_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {DM_POLICY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="ws-row">
            <span className="lines grow">
              <span>
                <Localized k="settings.interface.who_can_send_you_requests_20a495f" />
              </span>
              <small>
                <Localized k="settings.interface.message_requests_and_connection_requests_anyone_else_is_told_you_7d43737" />
              </small>
            </span>
            <select
              className="input input-sm"
              aria-label={uiText("settings.interface.who_can_send_you_requests_20a495f")}
              disabled={!s || act.busy}
              value={s?.requestPolicy ?? "everyone"}
              onChange={(e) => void act.act(async () => setLocal(await setMessagingSettings(engine, { requestPolicy: e.target.value as RequestPolicy })))}
            >
              {s?.requestPolicy === UNKNOWN && (
                <option value={UNKNOWN} disabled>
                  <Localized k="settings.interface.set_in_a_newer_version_of_meldiq_57dfd6c" />
                </option>
              )}
              {REQUEST_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {REQUEST_POLICY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <GroupAndSuggestRows
        settings={s ?? null}
        groupAdd={groupAdd}
        suggest={suggest}
        busy={act.busy}
        onChange={(change) => void act.act(async () => setLocal(await setMessagingSettings(engine, change)))}
      />
    </div>
  );
}
