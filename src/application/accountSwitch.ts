import { text as uiText } from "../i18n";
import type { OutboxItem } from "../model/types";
import type { Engine } from "../sync/engine";
import { transfersOf } from "../sync/transfers";
import { selectAccount, startAddingAccount } from "../auth/savedAccounts";
import { forgetRecentSearches } from "../ui/dialogs/SearchDialog";
import { AccountSession } from "../auth/accountSession";
/** Read receipts are derived from the read position and are sent again when the conversation opens. */
export function blocksAccountSwitch(item: OutboxItem): boolean {
  if (item.cls === "message") return true;
  try {
    return JSON.parse(item.payloadJson).type !== "read";
  } catch {
    return true;
  }
}
/** Never discard an in-memory send or a live call when changing the active account. */
export async function switchSavedAccount(engine: Engine, database: string | null, href = "/"): Promise<void> {
  if (database === engine.store.name) return;
  if (engine.state.get().call.phase !== "idle") throw new Error(uiText("workspace.interface.leave_your_call_before_switching_accounts_7279e72"));
  if (
    (await engine.store.outbox()).some(blocksAccountSwitch) ||
    transfersOf(engine)
      .list()
      .some((t) => t.status === "running")
  )
    throw new Error(uiText("workspace.interface.wait_for_your_pending_messages_changes_and_uploads_to_finish_befo_b346cc6"));
  const session = engine.session instanceof AccountSession ? engine.session : null;
  try {
    await session?.suspend();
    await engine.snapshots.flush();
    if (database) await selectAccount(database);
    else await startAddingAccount();
  } catch (error) {
    session?.resume();
    throw error;
  }
  forgetRecentSearches();
  engine.stop();
  // Reloading also drops authenticated media URLs, open overlays, timers and outstanding old-account requests.
  location.replace(href);
}
