import { fileLimit, MAX_FILES_PER_MESSAGE } from "../../sync/attachments";
import { serverHost } from "../../app/config";
import { useState } from "react";
import { useOrbit } from "../../app/orbit";
import { setPrefs, usePrefs } from "../../app/prefs";
import { bytes } from "../format";
import { Toggle } from "../components/Toggle";

export function NotificationsPage() {
  const prefs = usePrefs();
  const supported = typeof Notification !== "undefined";
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(supported ? Notification.permission : "unsupported");
  const enable = async (on: boolean) => {
    if (!on) return setPrefs({ notifications: false });
    if (!supported) return;
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermission(p);
    setPrefs({ notifications: p === "granted" });
  };
  return (
    <>
      <h1>Notifications</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Desktop notifications</strong>
            <small>
              {permission === "unsupported"
                ? "This browser doesn't support notifications."
                : permission === "denied"
                  ? "Blocked in your browser's site settings. Allow notifications for this site there, then turn this on."
                  : "A notification when a message arrives while you're looking elsewhere. Only while Meldiq is open in a tab."}
            </small>
          </div>
          <Toggle label="Desktop notifications" checked={prefs.notifications && permission === "granted"} onChange={(v) => void enable(v)} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Show message text</strong>
            <small>Off: notifications only say "New message".</small>
          </div>
          <Toggle label="Show message text in notifications" checked={prefs.notificationText} onChange={(v) => setPrefs({ notificationText: v })} />
        </div>
      </div>
      <h1 style={{ fontSize: 17, marginTop: 8 }}>Conversations</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Send read receipts</strong>
            <small>In direct messages and groups of up to 20, people see when you've read their messages. Reading here also clears unread on your phone.</small>
          </div>
          <Toggle label="Send read receipts" checked={prefs.readReceipts} onChange={(v) => setPrefs({ readReceipts: v })} />
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Typing indicators</strong>
            <small>Let others see when you're typing.</small>
          </div>
          <Toggle label="Typing indicators" checked={prefs.typing} onChange={(v) => setPrefs({ typing: v })} />
        </div>
      </div>
    </>
  );
}

export function AppearancePage() {
  const prefs = usePrefs();
  return (
    <>
      <h1>Appearance</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Theme</strong>
            <small>Ivory for light, Cocoa for dark: the palettes of Meldiq on your phone.</small>
          </div>
          <div className="segmented" role="group" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((t) => (
              <button key={t} aria-pressed={prefs.theme === t} onClick={() => setPrefs({ theme: t })}>
                {t === "system" ? "System" : t === "light" ? "Ivory" : "Cocoa"}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Enter sends the message</strong>
            <small>Off: Enter adds a line and Ctrl+Enter (⌘+Enter) sends.</small>
          </div>
          <Toggle label="Enter sends" checked={prefs.enterToSend} onChange={(v) => setPrefs({ enterToSend: v })} />
        </div>
      </div>
    </>
  );
}

export function AboutPage() {
  const server = useOrbit((s) => s.server);
  const me = useOrbit((s) => s.me);
  const history = useOrbit((s) => s.history);
  return (
    <>
      <h1>About</h1>
      <div className="card">
        <div className="setting">
          <div className="lines">
            <strong>Server</strong>
            <small>
              {serverHost()}
              {server ? ` · ${server.instanceName ?? "Meldiq"} ${server.version} · client API ${server.api}` : ""}
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>This browser</strong>
            <small>{me?.deviceName}</small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Encrypted history</strong>
            <small>
              {history.status === "unsupported"
                ? "This server doesn't keep encrypted history; this browser shows what it received since it was linked."
                : history.status === "done"
                  ? `Restored from your server. ${history.unreadable ? `${history.unreadable} items couldn't be read.` : ""}`
                  : history.status === "running"
                    ? "Restoring…"
                    : history.status === "error"
                      ? `Not restored: ${history.error}`
                      : "Waiting"}
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Files</strong>
            <small>
              Up to {bytes(fileLimit(server))} per file, {MAX_FILES_PER_MESSAGE} files per message. Files are kept 7 days on the server unless saved with history.
            </small>
          </div>
        </div>
        <div className="setting">
          <div className="lines">
            <strong>Calls</strong>
            <small>
              {server?.calling
                ? "Voice and video calls work in this browser and in Meldiq on your phone. Call media is end-to-end encrypted with a new key for every call; the browser asks before it uses your microphone or camera."
                : "This server has no calling configured."}
            </small>
          </div>
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12.5 }}>
        Meldiq Web 0.1.0 · Plus Jakarta Sans is used under the SIL Open Font License (<a href="/fonts/OFL.txt">license</a>).
      </p>
    </>
  );
}
