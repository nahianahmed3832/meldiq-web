import { AppWindow, MonitorX, ShieldOff } from "lucide-react";
import { OrbitMark } from "./components/OrbitMark";

export function LoadingScreen() {
  return (
    <main className="status-screen" aria-busy="true">
      <div className="status-card">
        <OrbitMark size={56} />
        <p className="muted">Opening Orbit…</p>
      </div>
    </main>
  );
}

export function UnsupportedScreen({ missing }: { missing: string[] }) {
  return (
    <main className="status-screen">
      <div className="status-card card">
        <span className="empty-orb">
          <MonitorX size={26} />
        </span>
        <h1>This browser can't run Orbit</h1>
        <p>Orbit keeps your keys in the browser and encrypts every message on this computer. It needs {missing.join(", ")}.</p>
        <p className="faint">Use a current version of Chrome, Edge, Firefox or Safari, over HTTPS.</p>
      </div>
    </main>
  );
}

export function ElsewhereScreen({ onUseHere }: { onUseHere: () => void }) {
  return (
    <main className="status-screen">
      <div className="status-card card">
        <span className="empty-orb">
          <AppWindow size={26} />
        </span>
        <h1>Orbit is open in another tab</h1>
        <p>This browser is one Orbit device, and one tab at a time keeps it connected.</p>
        <button className="btn btn-primary btn-lg" onClick={onUseHere}>
          Use Orbit here
        </button>
      </div>
    </main>
  );
}

const REASONS: Record<string, string> = {
  device_revoked: "This browser was removed from your account, from another of your devices. Its keys and the messages it kept have been erased.",
  account_disabled: "Your account is disabled on this server. This browser's keys and messages have been erased.",
  unknown_device: "The server no longer knows this browser (it may have been reset). Its keys and the messages it kept have been erased.",
};

export function RevokedScreen({ reason, message, onLinkAgain }: { reason: string | null; message?: string; onLinkAgain: () => void }) {
  return (
    <main className="status-screen">
      <div className="status-card card">
        <span className="empty-orb">
          <ShieldOff size={26} />
        </span>
        <h1>{message ? "Orbit couldn't start" : "Signed out"}</h1>
        <p>{message ?? (reason && REASONS[reason]) ?? "This browser is no longer linked to your account."}</p>
        <button className="btn btn-primary btn-lg" onClick={onLinkAgain}>
          {message ? "Try again" : "Link this browser again"}
        </button>
      </div>
    </main>
  );
}
