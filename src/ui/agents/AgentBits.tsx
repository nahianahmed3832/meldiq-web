import { Bot, Download, Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { useEngine } from "../../application/orbit";
import { type AiFile, avatarUrl, fileUrl } from "../../sync/aiWorkforce";

/**
 * Small pieces of the AI Workforce screens: an agent's avatar (always with the AI badge, so an agent never passes for
 * a person), a deliverable's preview and download (the bytes need the bearer token, so they're fetched into a blob),
 * and a form built from a skill's input schema.
 */
export function AgentAvatar({ orgId, installId, name, color, hasAvatar, size = 32 }: { orgId: string; installId: string; name: string; color: string | null; hasAvatar: boolean; size?: number }) {
  const engine = useEngine();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasAvatar) return;
    let gone = false;
    let made: string | null = null;
    avatarUrl(engine, orgId, installId)
      .then((u) => {
        made = u;
        if (!gone) setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [engine, orgId, installId, hasAvatar]);
  return (
    <span className="agent-avatar" style={{ width: size, height: size, background: color ?? "var(--accent)" }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : (name.trim()[0]?.toUpperCase() ?? <Bot size={size * 0.6} />)}
      <span className="agent-badge">AI</span>
    </span>
  );
}

const sizeText = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const PREVIEWABLE = /^(image\/(png|jpeg|webp|gif)|video\/mp4|audio\/mpeg|text\/(plain|markdown|csv)|application\/(json|x-subrip)|text\/(x-diff|calendar))$/;

export function AgentFileView({ orgId, file, autoPreview = false }: { orgId: string; file: AiFile; autoPreview?: boolean }) {
  const engine = useEngine();
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const media = file.mime.startsWith("image/") || file.mime.startsWith("video/") || file.mime.startsWith("audio/");
  const load = async () => {
    try {
      const u = await fileUrl(engine, orgId, file);
      if (media) setUrl(u);
      else {
        setText((await (await fetch(u)).text()).slice(0, 20_000));
        URL.revokeObjectURL(u);
      }
    } catch {
      setError("Couldn't load this file.");
    }
  };
  useEffect(() => {
    if (autoPreview && media && file.size < 50 * 1024 * 1024) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads once per file
  }, [file.id]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const download = async () => {
    const u = await fileUrl(engine, orgId, file);
    const a = document.createElement("a");
    a.href = u;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 10_000);
  };
  return (
    <div className="agent-file">
      <div className="row" style={{ gap: 8 }}>
        <span className="grow ellipsis">
          <strong>{file.name}</strong>{" "}
          <span className="faint">
            {sizeText(file.size)}
            {file.version > 1 ? ` · version ${file.version}` : ""}
            {file.approvalState === "superseded" ? " · replaced" : file.approvalState === "pending" ? " · waiting for approval" : file.approvalState === "approved" ? " · approved" : ""}
          </span>
        </span>
        {PREVIEWABLE.test(file.mime) && !url && text === null && (
          <button className="btn btn-sm btn-secondary" onClick={() => void load()}>
            <Eye size={14} /> Preview
          </button>
        )}
        <button className="btn btn-sm btn-secondary" onClick={() => void download()} aria-label={`Download ${file.name}`}>
          <Download size={14} />
        </button>
      </div>
      {error && <small className="danger-text">{error}</small>}
      {url && file.mime.startsWith("image/") && <img className="agent-preview" src={url} alt={file.name} />}
      {url && file.mime.startsWith("video/") && <video className="agent-preview" src={url} controls playsInline />}
      {url && file.mime.startsWith("audio/") && <audio src={url} controls />}
      {text !== null && <pre className="agent-text">{text}</pre>}
    </div>
  );
}

/** A JSON Schema property this form can show (top-level only; the brief is asked separately). */
interface Prop {
  type?: string | string[];
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  items?: { enum?: unknown[]; type?: string };
  anyOf?: Prop[];
}

/** A nullable field ({anyOf: [X, {type: "null"}]}) as X, keeping the outer default. */
function norm(p: Prop): Prop {
  if (!p.anyOf) return p;
  const real = p.anyOf.find((x) => x.type !== "null") ?? {};
  return { ...real, default: p.default ?? real.default };
}

const LABELS: Record<string, string> = {
  targetSeconds: "Length (seconds)",
  captions: "Captions",
  title: "Title",
  brandText: "Brand text",
  task: "Task",
  format: "Format",
  length: "Length",
  tone: "Tone",
  audience: "Audience",
  size: "Image size",
  count: "Images",
  platforms: "Platforms",
  posts: "Posts",
  drafts: "Drafts",
  targetLanguage: "Translate into",
  hoursPerDay: "Working hours per day",
  urls: "Public pages (one per line)",
};
const label = (k: string) => LABELS[k] ?? k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Fields for a skill's options (enums, numbers, booleans, short text, lists of choices or addresses). */
export function SkillFields({ schema, value, onChange }: { schema: unknown; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const props = ((schema as { properties?: Record<string, Prop> } | null)?.properties ?? {}) as Record<string, Prop>;
  const keys = Object.keys(props).filter((k) => k !== "brief");
  if (!keys.length) return null;
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="agent-fields">
      {keys.map((k) => {
        const p = norm(props[k]!);
        const types = Array.isArray(p.type) ? p.type : [p.type];
        const cur = value[k] ?? p.default;
        if (p.enum)
          return (
            <label key={k} className="field">
              <span>{label(k)}</span>
              <select value={String(cur ?? "")} onChange={(e) => set(k, e.target.value)}>
                {p.enum.map((o) => (
                  <option key={String(o)} value={String(o)}>
                    {String(o).replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          );
        if (types.includes("boolean"))
          return (
            <label key={k} className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={cur === true} onChange={(e) => set(k, e.target.checked)} /> {label(k)}
            </label>
          );
        if (types.includes("integer") || types.includes("number"))
          return (
            <label key={k} className="field">
              <span>{label(k)}</span>
              <input
                type="number"
                min={p.minimum}
                max={p.maximum}
                value={cur === undefined || cur === null ? "" : String(cur)}
                onChange={(e) => set(k, e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </label>
          );
        if (types.includes("array") && p.items?.enum)
          return (
            <fieldset key={k} className="field">
              <legend>{label(k)}</legend>
              <span className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                {p.items.enum.map((o) => {
                  const list = Array.isArray(cur) ? (cur as unknown[]) : [];
                  return (
                    <label key={String(o)} className="row" style={{ gap: 6 }}>
                      <input type="checkbox" checked={list.includes(o)} onChange={(e) => set(k, e.target.checked ? [...list, o] : list.filter((x) => x !== o))} /> {String(o)}
                    </label>
                  );
                })}
              </span>
            </fieldset>
          );
        if (types.includes("array") && p.items?.type === "string")
          return (
            <label key={k} className="field">
              <span>{label(k)}</span>
              <textarea
                rows={2}
                value={Array.isArray(cur) ? (cur as string[]).join("\n") : ""}
                onChange={(e) =>
                  set(
                    k,
                    e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          );
        if (types.includes("string"))
          return (
            <label key={k} className="field">
              <span>{label(k)}</span>
              <input value={typeof cur === "string" ? cur : ""} maxLength={p.maxLength} onChange={(e) => set(k, e.target.value === "" ? null : e.target.value)} />
            </label>
          );
        return null;
      })}
    </div>
  );
}
