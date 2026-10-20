import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { useState } from "react";
import type { OrgAdminDetail } from "../../api/workspaceSchemas";
import { useEngine } from "../../app/orbit";
import { navigate } from "../../app/router";
import { type AiStatus, aiStatus, REASON_TEXT, setAiPolicy } from "../../sync/ai";
import { AiAskDialog } from "../ai/AiDialogs";
import { useAction, useLoad } from "./useLoad";
import { Card, ErrorLine } from "./WorkspaceView";

/**
 * Workspace › AI (android round 7 C8 AiScreen, server docs/AI.md): what's sent and kept, asking the workspace's
 * documents, and for admins the switch and which configured provider the workspace uses.
 */
export function AiPage({ detail }: { detail: OrgAdminDetail }) {
  const engine = useEngine();
  const orgId = detail.org.id;
  const loaded = useLoad(() => aiStatus(engine, orgId), [engine, orgId]);
  const [changed, setChanged] = useState<AiStatus | null>(null);
  const [asking, setAsking] = useState(false);
  const act = useAction();
  const s = changed ?? loaded.data;
  const policy = (enabled: boolean, provider: string) => void act.act(async () => setChanged(await setAiPolicy(engine, orgId, enabled, provider)));
  return (
    <div className="ws-page">
      <ErrorLine text={loaded.error ?? act.error} />
      {!s ? (
        !loaded.error && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />
      ) : (
        <>
          {s.reason && (
            <div className="banner" role="status">
              {REASON_TEXT[s.reason] ?? REASON_TEXT.workspace_off}
            </div>
          )}
          {s.canManage && s.providers.length > 0 && (
            <Card title="AI in this workspace" sub="Off until an admin turns it on. Each person chooses what to send, every time.">
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={s.enabled} disabled={act.busy} onChange={(e) => policy(e.target.checked, s.chosenProvider ?? "default")} />
                <span>{s.enabled ? "On" : "Off"}</span>
              </label>
              <div className="field">
                <span>Provider</span>
                <span className="segmented" role="group" aria-label="Provider">
                  <button aria-pressed={s.chosenProvider === null} disabled={act.busy} onClick={() => policy(s.enabled, "default")}>
                    Server default ({s.providers[0].name})
                  </button>
                  {s.providers.map((p) => (
                    <button key={p.id} aria-pressed={s.chosenProvider === p.id} disabled={act.busy} onClick={() => policy(s.enabled, p.id)}>
                      {p.name}
                    </button>
                  ))}
                </span>
              </div>
            </Card>
          )}
          {s.provider && (
            <p className="faint" style={{ margin: 0 }}>
              {s.provider.name}
              {s.provider.model ? ` · ${s.provider.model}` : ""} · This month: {s.monthly.used} of {s.monthly.limit ?? "no limit"} requests
            </p>
          )}
          {s.available && (
            <Card title="Ask your documents" sub="Meldiq finds documents you can read that match, then sends the question and those documents.">
              <button className="btn btn-secondary" style={{ justifySelf: "start" }} onClick={() => setAsking(true)}>
                <MessageCircleQuestion size={15} /> Ask a question
              </button>
            </Card>
          )}
          <Card title="What's sent">
            <p className="row" style={{ gap: 10, margin: 0, alignItems: "flex-start" }}>
              <Sparkles size={18} className="faint" style={{ flex: "none", marginTop: 2 }} />
              <span>
                Nothing is sent unless you press Send. Messages stay end-to-end encrypted: only the messages you choose are decrypted in this browser and sent. Meldiq keeps no copy of what's sent or
                answered; it counts requests only.
              </span>
            </p>
          </Card>
        </>
      )}
      {asking && (
        <AiAskDialog
          orgId={orgId}
          onClose={() => setAsking(false)}
          onOpenDocument={(id) => {
            setAsking(false);
            navigate({ section: "workspace", workspacePage: "documents", itemId: id });
          }}
        />
      )}
    </div>
  );
}
