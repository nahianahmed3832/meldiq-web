"use strict";
(() => {
  const result = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname);
  const id = result.get("id");
  const receipt = result.get("receipt");
  const error = result.get("error");
  const valid = /^[A-Za-z0-9_-]{43}$/.test(id || "") && (error || /^[A-Za-z0-9_-]{43}$/.test(receipt || ""));
  if (valid) {
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
    document.getElementById("status").textContent = "Return to your Meldiq tab to finish signing in. You can close this window.";
    // Close only after the initiating tab acknowledges the return; an orphan keeps its recovery message.
  } else {
    document.getElementById("status").textContent = "This sign-in window is no longer connected. Return to Meldiq and start sign-in again.";
  }
})();
