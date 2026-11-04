import { useEffect, useRef, useState } from "react";
import type { Engine } from "../../sync/engine";
import { directoryPage, type DirectoryPage } from "../../sync/workspaces";

export function useDirectoryPages(engine: Engine, orgId: string, q: string, role: string, revision: number, enabled: boolean) {
  const scope = JSON.stringify([engine.device.userId, orgId, q, role, revision, enabled]);
  const current = useRef(scope);
  const active = useRef(false);
  const [state, setState] = useState<{ scope: string; page: DirectoryPage; loading: boolean; error: string | null }>({ scope, page: { members: [] }, loading: true, error: null });
  const request = async (after?: string) => {
    if (active.current) return;
    active.current = true;
    setState((s) => (s.scope === scope ? { ...s, loading: true, error: null } : { scope, page: { members: [] }, loading: true, error: null }));
    try {
      const page = await directoryPage(engine, orgId, q, role, after);
      if (current.current === scope)
        setState((s) => ({
          scope,
          page: { ...page, members: after ? [...s.page.members, ...page.members.filter((m) => !s.page.members.some((old) => old.id === m.id))] : page.members },
          loading: false,
          error: null,
        }));
    } catch (error) {
      if (current.current === scope) setState((s) => ({ ...s, scope, loading: false, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      if (current.current === scope) active.current = false;
    }
  };
  useEffect(() => {
    current.current = scope;
    active.current = false;
    if (enabled) void request();
    else setState({ scope, page: { members: [] }, loading: false, error: null });
    return () => {
      current.current = "";
    };
    // Scope contains every request input. A request from an old scope cannot update the new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, engine]);
  const visible = state.scope === scope ? state : { scope, page: { members: [] }, loading: true, error: null };
  return {
    data: visible.page.members,
    total: visible.page.total,
    ownerCount: visible.page.ownerCount,
    nextAfter: visible.page.nextAfter,
    loading: visible.loading,
    error: visible.error,
    more: () => request(visible.page.nextAfter ?? undefined),
  };
}
