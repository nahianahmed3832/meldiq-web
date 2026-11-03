import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Avatar } from "../components/Avatar";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { ArrowRightLeft, Check, Plus } from "lucide-react";
import { useEngine, useOrbit } from "../../application/orbit";
import { rememberAccount, type SavedAccount } from "../../auth/savedAccounts";
import { signOut, SignOutUnconfirmed } from "../../sync/account";
import { switchSavedAccount } from "../../application/accountSwitch";
import { Dialog } from "../components/Overlay";
type Action = "switch" | "logout";
interface AccountActionsValue {
  open: (action: Action) => void;
  accounts: SavedAccount[];
  current: string;
  busy: boolean;
  switchTo: (database: string) => void;
  add: () => void;
}
const AccountActions = createContext<AccountActionsValue | null>(null);
export function useAccountSwitcher(): AccountActionsValue {
  const value = useContext(AccountActions);
  if (!value) throw new Error("Account controls must be inside AccountActionsProvider");
  return value;
}
export const useAccountActions = () => useAccountSwitcher().open;
/** Shared by desktop account controls, the mobile profile menu and settings. */
export function AccountActionsProvider({ children, onSignedOut }: { children: ReactNode; onSignedOut: () => void | Promise<void> }) {
  useLocaleRender();
  const engine = useEngine();
  const me = useOrbit((s) => s.me);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  useEffect(() => {
    let live = true;
    void rememberAccount(engine.store.name, { ...engine.device, username: me?.username ?? engine.device.username }, me?.displayName, me?.avatarColor)
      .then((d) => {
        if (live) setAccounts(d.accounts);
      })
      .catch(() => engine.notice("error", uiText("workspace.interface.couldn_t_update_the_saved_account_list_try_again_e225acb")));
    return () => {
      live = false;
    };
  }, [engine, me?.displayName, me?.username, me?.avatarColor]);
  const close = () => {
    if (!busy) {
      setAction(null);
      setError(null);
    }
  };
  const changeAccount = async (database: string | null) => {
    if (busy || database === engine.store.name) return;
    setBusy(true);
    setError(null);
    try {
      await switchSavedAccount(engine, database);
    } catch (e) {
      const message = e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_switch_accounts_try_again_0aca05d");
      setError(message);
      setAction("switch");
      setBusy(false);
    }
  };
  const finish = async (force = false) => {
    setBusy(true);
    setError(null);
    try {
      await signOut(engine, force, true);
      await onSignedOut();
    } catch (e) {
      setUnconfirmed(e instanceof SignOutUnconfirmed);
      setError(e instanceof Error ? e.message : uiText("workspace.interface.couldn_t_sign_out_try_again_9eb51a7"));
      setBusy(false);
    }
  };
  return (
    <AccountActions.Provider
      value={{
        accounts,
        current: engine.store.name,
        busy,
        open: (next) => {
          setError(null);
          setUnconfirmed(false);
          setAction(next);
        },
        switchTo: (database) => void changeAccount(database),
        add: () => void changeAccount(null),
      }}
    >
      {children}
      {action === "switch" && (
        <Dialog title={uiText("settings.interface.switch_account_fedce01")} onClose={close}>
          <div className="dialog-body saved-account-list">
            <p className="muted" style={{ margin: 0 }}>
              <Localized k="workspace.interface.your_accounts_stay_signed_in_on_this_browser_choose_one_to_contin_c762644" />
            </p>
            {accounts.map((a) => (
              <button
                key={a.database}
                className="saved-account-row"
                disabled={busy}
                aria-label={uiText("workspace.interface.switch_to_value0_value1_e96405c", { value0: a.displayName, value1: a.username })}
                aria-pressed={a.database === engine.store.name}
                onClick={() => void changeAccount(a.database)}
              >
                <Avatar name={a.displayName} colorIndex={a.avatarColor} size={38} decorative />
                <span className="lines grow">
                  <strong>{a.displayName}</strong>
                  <small>@{a.username}</small>
                </span>
                {a.database === engine.store.name ? <Check size={18} /> : <ArrowRightLeft size={17} />}
              </button>
            ))}
            <button className="btn btn-primary" disabled={busy} onClick={() => void changeAccount(null)}>
              <Localized k="workspace.interface.add_account_4b58912" slots={[<Plus size={17} />]} />
            </button>
            {error && (
              <div className="banner danger" role="alert">
                {error}
              </div>
            )}
          </div>
        </Dialog>
      )}
      {action === "logout" && (
        <Dialog
          title={uiText("workspace.interface.log_out_of_meldiq_c88c1cb")}
          onClose={close}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={close}>
                <Localized k="settings.interface.stay_signed_in_b0a1ca8" />
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => void finish(unconfirmed)}>
                {busy ? uiText("settings.interface.signing_out_08c6bd3") : unconfirmed ? uiText("settings.interface.sign_out_anyway_bb14a8b") : uiText("settings.interface.log_out_4961614")}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>
              <Localized
                k="workspace.interface.log_out_of_on_this_browser_your_other_accounts_stay_signed_in_cc7ffcf"
                slots={[me?.displayName ?? uiText("workspace.interface.this_account_2faca96")]}
              />
            </p>
            <p className="muted" style={{ margin: 0 }}>
              <Localized k="workspace.interface.your_chats_stay_on_meldiq_and_return_when_you_sign_in_again_c2c4f03" />
            </p>
            {error && (
              <div className="banner danger" role="alert">
                {error}
                {unconfirmed && uiText("workspace.interface.the_server_couldn_t_confirm_removal_try_again_later_or_sign_out_a_71c59bf")}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </AccountActions.Provider>
  );
}
