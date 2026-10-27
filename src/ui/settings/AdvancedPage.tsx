import { X } from "lucide-react";
import { setPrefs, usePrefs } from "../../application/prefs";
import { Toggle } from "../components/Toggle";

/**
 * Settings › Advanced (2026-10-28): Builder mode adds Copy ID to the menus of communities, channels, messages and
 * people, for people building bots and tools; trusted sites open their links without asking (Appearance › Ask before
 * opening links), except links that look misleading, which always ask. Both are this browser's own.
 */
export function AdvancedPage() {
  const prefs = usePrefs();
  return (
    <>
      <h1>Advanced</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Builder mode</strong>
            <small>Adds Copy ID to the right-click menus of communities, channels, messages and people, for building bots and tools.</small>
          </div>
          <Toggle label="Builder mode" checked={prefs.builderMode} onChange={(v) => setPrefs({ builderMode: v })} />
        </div>
      </div>
      <h2 className="settings-group">Trusted sites</h2>
      <div className="card" style={{ padding: 16 }}>
        {prefs.trustedSites.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            Links to sites you trust open without asking. You haven't trusted any yet: choose Always trust when a link asks.
          </p>
        ) : (
          <ul className="trusted-list" aria-label="Trusted sites">
            {prefs.trustedSites.map((h) => (
              <li key={h}>
                <span className="mono ellipsis">{h}</span>
                <button className="icon-btn" aria-label={`Stop trusting ${h}`} onClick={() => setPrefs({ trustedSites: prefs.trustedSites.filter((x) => x !== h) })}>
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
