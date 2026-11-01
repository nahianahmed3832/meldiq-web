import { HeartHandshake, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { getPrefs, setPrefs, usePrefs } from "../../application/prefs";
import { navigate, useRoute } from "../../application/router";
import { recordSupportActivity, SUPPORT_EXPLORE_MS, SUPPORT_KEY, SUPPORT_SNOOZE_MS, SUPPORT_TICK_MS, supportOnSale, supportProgress, supportReminderDue } from "../../application/plusSupport";
import { money } from "./mojoFormat";

/** Occasional in-app support reminders. No push permission, network requests, focus changes or sound. */
export function PlusSupportNotice({ blocked }: { blocked: boolean }) {
  const engine = useEngine();
  const mojo = useOrbit((s) => s.mojo);
  const ready = useOrbit((s) => s.phase === "ready" && s.synced && s.connection === "online");
  const calling = useOrbit((s) => s.call.phase !== "idle" && s.call.phase !== "ended");
  const notices = useOrbit((s) => s.notices.length > 0);
  const paused = useOrbit((s) => (s.me?.notificationsPausedUntil ?? 0) > Date.now());
  const route = useRoute();
  const prefs = usePrefs();
  const [visible, setVisible] = useState(false);
  const context = useRef({ ready, blocked, calling, notices, paused, mojo, route });
  useEffect(() => {
    context.current = { ready, blocked, calling, notices, paused, mojo, route };
  });

  useEffect(() => {
    let alive = true;
    let pending = false;
    let shown = false;
    let visitActiveMs = 0;
    let lastTick = Date.now();
    let lastInput = Date.now();
    const input = () => (lastInput = Date.now());
    const tick = async () => {
      const now = Date.now();
      const elapsed = now - lastTick;
      lastTick = now;
      const ctx = context.current;
      if (pending || !ctx.ready || !getPrefs().plusReminders || !supportOnSale(ctx.mojo) || document.visibilityState !== "visible" || !document.hasFocus() || now - lastInput > 120_000) return;
      pending = true;
      try {
        let progress = supportProgress(await engine.store.getValue(SUPPORT_KEY), engine.device.userId);
        if (!alive) return;
        progress = recordSupportActivity(progress, now, elapsed);
        visitActiveMs += Math.max(0, Math.min(SUPPORT_TICK_MS, elapsed));
        const quiet = !ctx.blocked && !ctx.calling && !ctx.notices && !ctx.paused && !ctx.route.conversationId && !["settings", "workspace", "oauth"].includes(ctx.route.section);
        const editing = document.activeElement?.matches("input, textarea, [contenteditable='true']");
        const popup = document.querySelector("[role='dialog'], [role='menu'], .lightbox");
        const due = !shown && quiet && !editing && !popup && now - lastInput >= SUPPORT_TICK_MS && supportReminderDue(progress, now, visitActiveMs);
        if (due) progress = { ...progress, lastShownAt: now };
        // Persist the impression before showing it, so an immediate reload still respects the cooldown.
        await engine.store.setValue(SUPPORT_KEY, progress);
        if (alive && due) {
          shown = true;
          setVisible(true);
        }
      } catch {
        // If reminder preferences cannot be persisted, stay quiet instead of repeating the prompt.
      } finally {
        pending = false;
      }
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const event of events) window.addEventListener(event, input, { passive: true, capture: true });
    const timer = setInterval(() => void tick(), SUPPORT_TICK_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      for (const event of events) window.removeEventListener(event, input, true);
    };
  }, [engine]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 30_000);
    return () => clearTimeout(timer);
  }, [visible]);

  const dismiss = async (delay: number) => {
    setVisible(false);
    const progress = supportProgress(await engine.store.getValue(SUPPORT_KEY), engine.device.userId);
    await engine.store.setValue(SUPPORT_KEY, { ...progress, snoozedUntil: Date.now() + delay });
  };
  const quiet = ready && !blocked && !calling && !notices && !paused && !route.conversationId && !["settings", "workspace", "oauth"].includes(route.section);
  if (!visible || !quiet || !prefs.plusReminders || !supportOnSale(mojo)) return null;
  const price = mojo.catalog!.onSale.plus!;
  return (
    <aside className="plus-support-notice" role="status" aria-live="polite" aria-labelledby="plus-support-title">
      <div className="plus-support-heading">
        <HeartHandshake size={20} aria-hidden="true" />
        <strong id="plus-support-title">Help keep Meldiq independent</strong>
        <button className="icon-btn" aria-label="Remind me in 30 days" onClick={() => void dismiss(SUPPORT_SNOOZE_MS).catch(() => undefined)}>
          <X size={17} />
        </button>
      </div>
      <p>We’re choosing community support over corporate investment. Mojo Plus helps pay for servers and ongoing development.</p>
      <small>Plus is optional · {money(price.amountMinor, price.currency)}/month · Renews until canceled.</small>
      <div className="plus-support-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            void dismiss(SUPPORT_EXPLORE_MS).catch(() => undefined);
            navigate({ section: "settings", settingsPage: "mojo" });
          }}
        >
          Explore Plus
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setVisible(false);
            setPrefs({ plusReminders: false });
          }}
        >
          Don’t show again
        </button>
      </div>
    </aside>
  );
}
