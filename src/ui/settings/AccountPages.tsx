import { HistoryPrivacy } from "../experience/HistoryPrivacy";
import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { KeyRound, Laptop, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Device } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { listDevices, revokeDevice } from "../../sync/account";
import { BlockedPeople, MessagingSettings, PrivacySettings } from "./PrivacyPage";
import { LeaveManyCard } from "./PrivacyExtras";
import { AuthenticationSettings } from "./AccountSettingsPage";
import { SessionsCard } from "./SessionsCard";
import { AccountApi } from "../../auth/accountApi";
import { ConnectedAccountsCard } from "./ConnectedAccountsCard";
import { ConnectionsCard } from "./ConnectionsCard";
import { LogOutEverywhereCard } from "./AccountExtrasCards";
import { ConversationPrivacy, LinkSafetySettings } from "./SpecializedPages";
import { AuthorizedAppsCard } from "./AuthorizedAppsCard";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
export function DevicesPage({ onSignedOut }: { onSignedOut: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<Device | null>(null);
  const load = useCallback(() => {
    listDevices(engine)
      .then((d) => {
        setDevices(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : uiText("settings.interface.couldn_t_load_devices_d19d986")));
  }, [engine]);
  useEffect(load, [load]);
  const active = (devices ?? []).filter((d) => !d.revokedAt);
  return (
    <>
      <div>
        <h1>{l10n("settings.navigation.devices")}</h1>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          <Localized k="settings.interface.every_phone_and_browser_signed_in_to_your_account_each_shows_the_42d5ec0" />
        </p>
      </div>
      {error && <div className="banner danger">{error}</div>}
      <div className="card">
        {!devices && !error && <span className="skeleton" style={{ display: "block", height: 120, margin: 16 }} />}
        {active.map((d) => (
          <div key={d.id} className="setting">
            <span className="empty-orb" style={{ width: 40, height: 40 }}>
              {/^(Meldiq|Orbit) Web/.test(d.name) ? <Laptop size={18} /> : <Smartphone size={18} />}
            </span>
            <div className="lines">
              <strong className="ellipsis">{d.name}</strong>
              <small>
                <Localized
                  k="settings.interface.linked_64ad510"
                  slots={[
                    d.current
                      ? uiText("settings.interface.this_browser_101f4d9")
                      : d.lastSeenAt
                        ? uiText("settings.interface.last_active_value0_a385902", { value0: relative(d.lastSeenAt) })
                        : uiText("settings.interface.never_connected_0dac373"),
                    relative(d.createdAt),
                  ]}
                />
              </small>
            </div>
            {d.current ? (
              <span className="tag ok">
                <Localized k="settings.interface.this_browser_101f4d9" />
              </span>
            ) : (
              <button className="btn btn-danger-quiet btn-sm" onClick={() => setRemove(d)}>
                <Trash2 size={14} /> {l10n("common.actions.remove")}
              </button>
            )}
          </div>
        ))}
      </div>
      {engine.device.account && (
        <>
          <SessionsCard accounts={new AccountApi(engine.api)} />
          <ConnectedAccountsCard />
          <LogOutEverywhereCard onSignedOut={onSignedOut} />
        </>
      )}
      <ConnectionsCard />
      <AuthorizedAppsCard />
      {remove && (
        <Dialog
          title={uiText("settings.interface.remove_value0_bc43ab8", { value0: remove.name })}
          onClose={() => setRemove(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setRemove(null)}>
                {l10n("common.actions.cancel")}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const d = remove;
                  setRemove(null);
                  revokeDevice(engine, d.id)
                    .then(load)
                    .catch((e: unknown) => setError(e instanceof Error ? e.message : uiText("settings.interface.couldn_t_remove_the_device_0c87487")));
                }}
              >
                <Localized k="settings.interface.remove_device_b6083ca" />
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>
              <Localized k="settings.interface.it_s_signed_out_at_once_and_can_t_open_your_chats_any_more_sign_i_42c2cba" />
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
/** All personal privacy and security controls; account actions are shared by the settings sidebar. */
export function SecurityPage() {
  useLocaleRender();
  const t = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  if (!me) return null;
  return (
    <>
      <h1>{t("settings.settings_security")}</h1>
      <HistoryPrivacy />
      <AuthenticationSettings />
      <div className="card">
        <div className="setting">
          <KeyRound size={20} className="faint" />
          <div className="lines">
            <strong>
              <Localized k="settings.interface.this_browser_s_device_key_2a973ce" />
            </strong>
            <small>
              <Localized k="settings.interface.what_your_other_device_showed_when_it_approved_this_browser_6d6b6c7" />
            </small>
            <span className="fingerprint">{me.deviceFingerprint}</span>
          </div>
        </div>
      </div>
      <MessagingSettings />
      <ConversationPrivacy />
      <PrivacySettings />
      <BlockedPeople />
      <LinkSafetySettings />
      <LeaveManyCard />
      <div className="card setting-card">
        <strong>
          <Localized k="settings.interface.where_your_data_lives_594b837" />
        </strong>
        <ul className="muted">
          <li>
            <Localized k="settings.interface.your_messages_files_and_settings_are_stored_on_meldiq_s_servers_s_85736bf" />
          </li>
          <li>
            {engine.device.account
              ? uiText("settings.interface.your_session_is_kept_encrypted_under_a_key_this_page_can_use_but_7e1a365")
              : uiText("settings.interface.the_session_token_is_held_in_memory_only_each_visit_signs_in_agai_5f644f9")}
          </li>
        </ul>
      </div>
    </>
  );
}
