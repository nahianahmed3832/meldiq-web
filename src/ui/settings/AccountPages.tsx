import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { useT as useLocalization } from "../../i18n";
import { KeyRound, Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Device } from "../../api/schemas";
import { useEngine, useOrbit } from "../../application/orbit";
import { listDevices, revokeDevice, signOut, SignOutUnconfirmed } from "../../sync/account";
import { BlockedPeople, MessagingSettings, PrivacySettings } from "./PrivacyPage";
import { LeaveManyCard } from "./PrivacyExtras";
import { AuthorizedAppsCard } from "./AuthorizedAppsCard";
import { Dialog } from "../components/Overlay";
import { relative } from "../format";
export function DevicesPage() {
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
        <h1>{l10n("settings.devices")}</h1>
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
export function SecurityPage({ onSignedOut }: { onSignedOut: () => void }) {
  useLocaleRender();
  const l10n = useLocalization();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [confirm, setConfirm] = useState<"ask" | "unconfirmed" | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  if (!me) return null;
  /**
   * [force]: even if the server can't confirm (asked first). Nothing needs backing up first: the server keeps every
   * message (API 0.57.0).
   */
  const doSignOut = (force: boolean) => {
    setBusy(true);
    signOut(engine, force, true)
      .then(onSignedOut)
      .catch((e: unknown) => {
        if (e instanceof SignOutUnconfirmed) {
          setReason(e.message);
          setConfirm("unconfirmed");
        } else engine.notice("error", e instanceof Error ? e.message : uiText("settings.interface.couldn_t_sign_out_f3c366a"));
      })
      .finally(() => setBusy(false));
  };
  return (
    <>
      <h1>{l10n("settings.settings_security")}</h1>
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
            <span className="fingerprint" style={{ fontSize: 13 }}>
              {me.deviceFingerprint}
            </span>
          </div>
        </div>
      </div>
      <MessagingSettings />
      <LeaveManyCard />
      <PrivacySettings />
      <BlockedPeople />
      <AuthorizedAppsCard />
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 10 }}>
        <strong>
          <Localized k="settings.interface.where_your_data_lives_594b837" />
        </strong>
        <ul className="muted" style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: 6, fontSize: 13.5 }}>
          <li>
            <Localized k="settings.interface.your_messages_files_and_settings_are_stored_on_meldiq_s_servers_s_85736bf" />
          </li>
          <li>
            <Localized k="settings.interface.this_browser_keeps_only_what_signs_it_in_nothing_to_back_up_and_n_3396ca5" />
          </li>
          <li>
            {engine.device.account
              ? uiText("settings.interface.your_session_is_kept_encrypted_under_a_key_this_page_can_use_but_7e1a365")
              : uiText("settings.interface.the_session_token_is_held_in_memory_only_each_visit_signs_in_agai_5f644f9")}
          </li>
        </ul>
      </div>
      <div className="card" style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
        <div>
          <strong>
            <Localized k="settings.interface.sign_out_of_this_browser_e6e2e83" />
          </strong>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            <Localized k="settings.interface.this_browser_leaves_your_account_and_forgets_its_sign_in_your_cha_0412bce" />
          </p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={() => setConfirm("ask")} disabled={busy}>
            <LogOut size={16} /> {l10n("auth.signOut")}
          </button>
        </div>
      </div>
      {confirm === "ask" && (
        <Dialog
          title={uiText("settings.interface.sign_out_of_this_browser_123427e")}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                {l10n("common.actions.cancel")}
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={() => doSignOut(false)}>
                {busy ? uiText("settings.interface.signing_out_08c6bd3") : l10n("auth.signOut")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>
              <Localized k="settings.interface.your_chats_stay_on_meldiq_s_servers_and_are_all_there_when_you_si_2871532" />
            </p>
          </div>
        </Dialog>
      )}
      {confirm === "unconfirmed" && (
        <Dialog
          title={uiText("settings.interface.the_server_couldn_t_confirm_255c134")}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>
                <Localized k="settings.interface.stay_signed_in_b0a1ca8" />
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => doSignOut(true)}>
                <Localized k="settings.interface.sign_out_anyway_bb14a8b" />
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>{reason}.</p>
            <p className="muted" style={{ margin: 0 }}>
              <Localized k="settings.interface.if_you_sign_out_now_the_server_still_lists_this_browser_as_a_devi_22be59f" />
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
