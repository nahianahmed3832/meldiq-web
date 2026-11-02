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
      .catch(() => engine.notice("error", "Couldn't update the saved account list. Try again."));
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
      const message = e instanceof Error ? e.message : "Couldn't switch accounts. Try again.";
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
      setError(e instanceof Error ? e.message : "Couldn't sign out. Try again.");
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
        <Dialog title="Switch account" onClose={close}>
          <div className="dialog-body saved-account-list">
            <p className="muted" style={{ margin: 0 }}>
              Your accounts stay signed in on this browser. Choose one to continue.
            </p>
            {accounts.map((a) => (
              <button
                key={a.database}
                className="saved-account-row"
                disabled={busy}
                aria-label={`Switch to ${a.displayName} (@${a.username})`}
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
              <Plus size={17} /> Add account
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
          title="Log out of Meldiq?"
          onClose={close}
          footer={
            <>
              <button className="btn btn-secondary" disabled={busy} onClick={close}>
                Stay signed in
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => void finish(unconfirmed)}>
                {busy ? "Signing out…" : unconfirmed ? "Sign out anyway" : "Log out"}
              </button>
            </>
          }
        >
          <div className="dialog-body">
            <p style={{ margin: 0 }}>Log out of {me?.displayName ?? "this account"} on this browser? Your other accounts stay signed in.</p>
            <p className="muted" style={{ margin: 0 }}>
              Your chats stay on Meldiq and return when you sign in again.
            </p>
            {error && (
              <div className="banner danger" role="alert">
                {error}
                {unconfirmed && ". The server couldn't confirm removal. Try again later, or sign out anyway and remove this browser from Devices elsewhere."}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </AccountActions.Provider>
  );
}
