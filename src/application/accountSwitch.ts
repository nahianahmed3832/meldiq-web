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
  if (engine.state.get().call.phase !== "idle") throw new Error("Leave your call before switching accounts.");
  if (
    (await engine.store.outbox()).some(blocksAccountSwitch) ||
    transfersOf(engine)
      .list()
      .some((t) => t.status === "running")
  )
    throw new Error("Wait for your pending messages, changes and uploads to finish before switching accounts.");
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
