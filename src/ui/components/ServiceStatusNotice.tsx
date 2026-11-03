import { useEffect, useRef, useState } from "react";
const STATUS_ORIGINS = ["https://status.meldiq.app", "https://meldiq-status.mellowniche.chatgpt.site"];
const RELEVANT = new Set(["api", "auth", "messaging", "realtime", "database", "background", "uploads", "downloads", "media", "calls", "push", "web", "payments", "paypal", "cdn"]);
const STORAGE = "meldiq.status.dismissed-incidents.v1";
type Incident = { id: string; title: string; components: string[] };
/** Public incident metadata only; independent of Meldiq sign-in and API availability. */
export function ServiceStatusNotice() {
  const [incident, setIncident] = useState<Incident | null>(null);
  const dismissed = useRef(new Set<string>());
  useEffect(() => {
    try { const values: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? "[]"); if (Array.isArray(values)) dismissed.current = new Set(values.filter((v): v is string => typeof v === "string").slice(-50)); } catch { /* Storage may be disabled. */ }
    let alive = true;
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      for (const origin of STATUS_ORIGINS) {
        const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), 4000);
        const stop = () => timeout.abort(); controller.signal.addEventListener("abort", stop, { once: true });
        try {
          const r = await fetch(`${origin}/api/public/summary`, { signal: timeout.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
          if (!r.ok) continue;
          const data: unknown = await r.json();
          if (!data || typeof data !== "object" || !Array.isArray((data as { incidents?: unknown }).incidents)) continue;
          const values = (data as { incidents: unknown[] }).incidents;
          const next = values.find((v): v is Incident => {
            if (!v || typeof v !== "object") return false;
            const i = v as Partial<Incident>;
            return typeof i.id === "string" && /^incident_[a-f0-9-]+$/.test(i.id) && typeof i.title === "string" && i.title.length <= 300 && Array.isArray(i.components) && i.components.some(c => RELEVANT.has(c)) && !dismissed.current.has(i.id);
          });
          if (alive) setIncident(next ?? null);
          return;
        } catch { /* An unreachable status provider must not block the app. */ }
        finally { clearTimeout(timer); controller.signal.removeEventListener("abort", stop); }
      }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  if (!incident) return null;
  return <aside className="meldiq-service-notice" role="status"><span>Meldiq service update: <a href={`${STATUS_ORIGINS[0]}/incidents/${encodeURIComponent(incident.id)}`} target="_blank" rel="noopener noreferrer">{incident.title}</a></span><button type="button" aria-label="Dismiss this service incident" onClick={() => { dismissed.current.add(incident.id); try { localStorage.setItem(STORAGE, JSON.stringify([...dismissed.current].slice(-50))); } catch { /* Keep the dismissal for this session. */ } setIncident(null); }}>×</button></aside>;
}
