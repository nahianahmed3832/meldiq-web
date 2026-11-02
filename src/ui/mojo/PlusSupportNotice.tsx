import { useEffect, useRef, useState } from "react";
import { useEngine, useOrbit } from "../../application/orbit";
import { getPrefs, setPrefs, usePrefs } from "../../application/prefs";
import { navigate, useRoute } from "../../application/router";
import { communicationBusy } from "../../application/updates";
import { supportOnSale, syncPlusReminderPreference } from "../../application/plusSupport";
import { zPromotionClaim, zPromotionCurrent, type Promotion } from "../../api/promotionSchemas";
import { transfersOf } from "../../sync/transfers";
import { PlusPromotion } from "./PlusPromotion";

/** All impressions are reserved by the backend before presentation; an unavailable backend always suppresses them. */
export function PlusSupportNotice({ blocked }: { blocked: boolean }) {
  const engine = useEngine();
  const mojo = useOrbit((s) => s.mojo);
  const ready = useOrbit((s) => s.phase === "ready" && s.synced && s.connection === "online");
  const calling = useOrbit((s) => s.call.phase !== "idle" && s.call.phase !== "ended");
  const notices = useOrbit((s) => s.notices.length > 0);
  const paused = useOrbit((s) => (s.me?.notificationsPausedUntil ?? 0) > Date.now());
  const route = useRoute();
  const prefs = usePrefs();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const context = useRef({ ready, blocked, calling, notices, paused, mojo, route });
  const current = useRef<Promotion | null>(null);
  const session = useRef(crypto.randomUUID());
  const preferenceReady = useRef(false);
  useEffect(() => {
    context.current = { ready, blocked, calling, notices, paused, mojo, route };
  });
  useEffect(() => {
    current.current = promotion;
  }, [promotion]);

  useEffect(() => {
    let alive = true;
    preferenceReady.current = false;
    if (ready)
      void syncPlusReminderPreference(engine)
        .then(() => {
          if (alive) preferenceReady.current = true;
        })
        .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [engine, ready]);

  useEffect(() => {
    let alive = true;
    let pending = false;
    let lastInput = Date.now();
    let lastActivity = 0;
    let claimed = false;
    const input = () => {
      lastInput = Date.now();
    };
    const safe = () => {
      const c = context.current;
      const otherDialog = [...document.querySelectorAll("[role='dialog'], [role='menu'], .lightbox")].some((el) => !el.closest(".plus-promotion-modal"));
      return (
        !communicationBusy() &&
        c.ready &&
        !c.blocked &&
        !c.calling &&
        !c.notices &&
        !c.paused &&
        !c.route.conversationId &&
        c.route.section === "home" &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        !otherDialog &&
        !document.activeElement?.matches("input, textarea, [contenteditable='true']") &&
        !document.querySelector("[role='progressbar'], [data-recording='true'], [data-downloading='true'], .voice-recording") &&
        !transfersOf(engine)
          .list()
          .some((t) => t.status === "running")
      );
    };
    const tick = async () => {
      if (pending || !context.current.ready || !preferenceReady.current) return;
      pending = true;
      try {
        const now = Date.now();
        if (!getPrefs().plusReminders || !supportOnSale(context.current.mojo)) {
          if (alive) setPromotion(null);
          return;
        }
        if (document.visibilityState === "visible" && document.hasFocus() && now - lastInput < 120_000 && now - lastActivity >= 15_000) {
          lastActivity = now;
          await engine.api.call("POST", "/v2/billing/promotions/activity", { body: { sessionId: session.current, onboardingComplete: true, active: true } });
        }
        if (!alive) return;
        if (!safe()) {
          setPromotion(null);
          return;
        }
        if (current.current) {
          const result = await engine.api.json("GET", `/v2/billing/promotions/${encodeURIComponent(current.current.id)}`, zPromotionCurrent);
          if (alive) setPromotion((p) => (result.active && p && result.expiresAt ? { ...p, expiresAt: result.expiresAt } : null));
        } else if (!claimed && now - lastInput >= 15_000) {
          const result = await engine.api.json("POST", "/v2/billing/promotions/claim", zPromotionClaim, {
            body: { sessionId: session.current, trigger: "consistent_usage", screen: "home", safe: true },
          });
          if (result.promotion) claimed = true;
          if (alive && safe()) setPromotion(result.promotion);
        }
      } catch {
        if (alive) setPromotion(null);
      } finally {
        pending = false;
      }
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    for (const e of events) window.addEventListener(e, input, { passive: true, capture: true });
    const timer = setInterval(() => void tick(), 5_000);
    return () => {
      alive = false;
      clearInterval(timer);
      for (const e of events) window.removeEventListener(e, input, true);
    };
  }, [engine]);

  useEffect(() => {
    if (!promotion) return;
    const timer = setTimeout(() => setPromotion(null), Math.max(0, promotion.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [promotion]);

  const impressionId = promotion?.id;
  useEffect(() => {
    if (impressionId) void engine.api.call("POST", "/v2/billing/promotions/events", { body: { impressionId, sessionId: session.current, event: "impression" } }).catch(() => setPromotion(null));
  }, [engine, impressionId]);

  const feedback = async (event: "dismiss" | "snooze" | "click" | "pricing_visit") => {
    const p = promotion;
    setPromotion(null);
    if (p) await engine.api.call("POST", "/v2/billing/promotions/events", { body: { impressionId: p.id, sessionId: session.current, event } });
  };
  const optOut = async () => {
    setPromotion(null);
    setPrefs({ plusReminders: false });
    try {
      await engine.api.call("PUT", "/v2/billing/promotions/preference", { body: { optOut: true } });
    } catch {
      engine.notice("error", "Reminders are hidden here. We couldn’t save your preference across devices; try again in Notifications settings.");
    }
  };
  const quiet = ready && !blocked && !calling && !notices && !paused && !route.conversationId && route.section === "home";
  if (!promotion || !quiet || !prefs.plusReminders || !supportOnSale(mojo)) return null;
  return (
    <PlusPromotion
      promotion={promotion}
      catalog={mojo.catalog!}
      onDismiss={() => void feedback("dismiss").catch(() => undefined)}
      onSnooze={() => void feedback("snooze").catch(() => undefined)}
      onUpgrade={() => {
        void Promise.all([feedback("click"), feedback("pricing_visit")]).catch(() => undefined);
        navigate({ section: "settings", settingsPage: "mojo" });
      }}
      onOptOut={() => void optOut()}
    />
  );
}
