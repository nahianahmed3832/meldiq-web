import { AccountApi } from "../auth/accountApi";
import type { Engine } from "./engine";

/** The account-wide "personal" selection: the browser shows no organisation then (its DMs and groups only). */
const PERSONAL = "personal";

/**
 * The selected workspace follows the account to every device (android WorkspaceSwitcher, PUT /v2/account/preferences).
 * Only Orbit 2.0 account devices have it; a browser linked before accounts keeps its choice locally.
 */
export async function accountSelection(engine: Engine): Promise<string | null> {
  if (!engine.device.account) return null;
  const { selectedWorkspaceId } = await new AccountApi(engine.api).workspaces();
  return selectedWorkspaceId && selectedWorkspaceId !== PERSONAL ? selectedWorkspaceId : null;
}

export async function rememberSelection(engine: Engine, orgId: string | null): Promise<void> {
  if (!engine.device.account) return;
  await new AccountApi(engine.api).selectWorkspace(orgId ?? PERSONAL);
}
