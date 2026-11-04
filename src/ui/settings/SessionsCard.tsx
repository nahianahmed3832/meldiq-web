import { useLocaleRender } from "../../i18n/Localized";
import { text as uiText, useT as useLocalization } from "../../i18n";
import { Localized } from "../../i18n/Localized";
import { Laptop, LogOut } from "lucide-react";
import { useState } from "react";
import { AccountApi } from "../../auth/accountApi";
import { relative } from "../format";
import { confirmAction } from "../components/ConfirmationDialog";
import { useAction, useLoad } from "../workspace/useLoad";
export function SessionsCard({ accounts }: { accounts: AccountApi }) {
  useLocaleRender();
  const l10n = useLocalization();
  const [version, setVersion] = useState(0);
  const list = useLoad(() => accounts.sessions(), [version]);
  const act = useAction();
  return (
    <div className="card" style={{ padding: 20, display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>
        <Localized k="settings.interface.where_you_re_signed_in_4f81119" />
      </h3>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        <Localized k="settings.interface.sessions_of_your_account_signing_one_out_keeps_that_device_s_keys_28a967f" />
      </p>
      {(list.error || act.error) && (
        <div className="banner danger" role="alert">
          {list.error ?? act.error}
        </div>
      )}
      <ul className="ws-list" aria-label={uiText("settings.interface.sessions_6fa3cbf")} aria-busy={list.loading}>
        {(list.data ?? []).map((s) => (
          <li key={s.id} className="ws-row">
            <Laptop size={18} className="faint" />
            <span className="lines grow">
              <span className="ellipsis">{s.label ?? uiText("settings.interface.unnamed_device_6aba593")}</span>
              <small>
                <Localized
                  k="settings.interface.signed_in_0623e9f"
                  slots={[relative(s.createdAt), s.lastUsedAt ? uiText("settings.interface.last_used_value0_2556352", { value0: relative(s.lastUsedAt) }) : ""]}
                />
              </small>
            </span>
            {s.current ? (
              <span className="status-badge status-active">
                <Localized k="settings.interface.this_browser_101f4d9" />
              </span>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                disabled={act.busy}
                onClick={async () => {
                  if (await confirmAction(uiText("settings.interface.sessions_of_your_account_signing_one_out_keeps_that_device_s_keys_28a967f")))
                    void act.act(() => accounts.endSession(s.id).then(() => setVersion((v) => v + 1)));
                }}
              >
                <LogOut size={14} /> {l10n("auth.signOut")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
