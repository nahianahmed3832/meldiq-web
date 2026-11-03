"use strict";
(() => {
  function setStatus(key) {
    const status = document.getElementById("status");
    status.dataset.publicText = key;
    if (window.meldiqPublicI18n) {
      const ui = window.meldiqPublicI18n;
      ui.label(status, key);
      for (const node of [document.querySelector("h1"), document.querySelector("title"), document.querySelector('a[href="/"]')]) if (node) ui.label(node, ui.keys.back);
    } else {
      const script = document.createElement("script");
      script.src = "/public-locale.js";
      script.onload = () => setStatus(key);
      document.head.appendChild(script);
    }
  }
  const result = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname);
  const id = result.get("id");
  const receipt = result.get("receipt");
  const error = result.get("error");
  const valid = /^[A-Za-z0-9_-]{43}$/.test(id || "") && (error || /^[A-Za-z0-9_-]{43}$/.test(receipt || ""));
  if (valid) {
    try {
      const pending = JSON.parse(sessionStorage.getItem("meldiq.desktop.browserFlow") || "null");
      if (pending?.kind === "social" && pending.id === id && pending.expires > Date.now()) {
        const q = new URLSearchParams({ kind: "social-return", id });
        if (receipt) q.set("receipt", receipt);
        if (error) q.set("error", error);
        location.replace(`/desktop-bridge.html#${q}`);
        return;
      }
    } catch {
      /* Existing web sign-in continues when storage is unavailable. */
    }

    const message = { type: "meldiq-social", id, receipt, error };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(`meldiq-social:${id}`);
        channel.onmessage = (event) => {
          if (event.data?.type !== "meldiq-social-ack" || event.data.id !== id) return;
          channel.close();
          window.close();
        };
        window.addEventListener("pagehide", () => channel.close(), { once: true });
        channel.postMessage(message);
      }
    } catch {
      /* The checked opener path still works when channel storage is unavailable. */
    }
    try {
      window.opener?.postMessage(message, location.origin);
    } catch {
      /* The provider may isolate its popup. */
    }
    setStatus("auth.public.returnTab");
    // Close only after the initiating tab acknowledges the return; an orphan keeps its recovery message.
  } else {
    setStatus("auth.public.orphan");
  }
})();
