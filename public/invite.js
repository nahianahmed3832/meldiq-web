// The meldiq.app/invite/CODE page (batch B4b): shows which community the invitation is for, using the public preview
// (name, description and size only; never channels or members), and hands the code to the app or Meldiq Web.
// Plain script, no build step: the page must load before the web app and under its Content-Security-Policy.
(function () {
  "use strict";
  var CODE = /^[A-Za-z0-9]{4}(-?[A-Za-z0-9]{4}){2,4}$/;
  var PROBLEMS = {
    invite_not_found: "This invitation link isn't valid. Ask for a new one.",
    invite_expired: "This invitation has expired. Ask for a new one.",
    invite_revoked: "This invitation was turned off. Ask for a new one.",
    invite_used_up: "This invitation has been used up. Ask for a new one.",
  };

  function el(id) { return document.getElementById(id); }
  function show(id, text) { var e = el(id); if (text !== undefined) e.textContent = text; e.hidden = false; }

  function codeFromPath(path) {
    var raw = decodeURIComponent(path.replace(/^\/invite\/?/, "").split("/")[0] || "");
    if (!CODE.test(raw)) return null;
    var plain = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return plain.match(/.{1,4}/g).join("-");
  }

  function problem(text) {
    // Nothing was invited to: no "You've been invited to join" above the reason.
    el("lead").hidden = true;
    el("name").textContent = "Invitation";
    show("problem", text);
  }

  var code = codeFromPath(window.location.pathname);
  if (!code) { problem(PROBLEMS.invite_not_found); return; }

  el("code").textContent = code;
  // On Android this opens the app when it's installed; App Links usually open it before this page loads at all.
  el("open-app").href = "meldiq://invite/" + encodeURIComponent(code);
  // Meldiq Web keeps the code through signing in and opens the community's preview with Join (src/application/pendingInvite.ts).
  el("open-web").href = "/join/" + encodeURIComponent(code);
  // On Android the app comes first.
  if (/Android/i.test(navigator.userAgent)) { el("open-app").className = "button primary"; el("open-web").className = "button"; el("open-app").parentNode.insertBefore(el("open-app"), el("open-web")); }
  el("copy").addEventListener("click", function () {
    var done = function () { el("copy").textContent = "Copied"; el("copy").setAttribute("aria-live", "polite"); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () {});
  });

  fetch("/v1/invites/" + encodeURIComponent(code) + "/public", { credentials: "omit" })
    .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
    .then(function (res) {
      if (!res.ok) {
        var c = res.body && res.body.error && res.body.error.code;
        problem(PROBLEMS[c] || "This invitation can't be opened right now. Try again later.");
        return;
      }
      var community = res.body.community || {};
      el("name").textContent = community.name || "A Meldiq community";
      if (community.name) {
        // The community's initials on Meldiq's gradient: the public preview carries no icon.
        var words = community.name.trim().split(/\s+/);
        var initials = (words.length > 1 ? words[0].charAt(0) + words[words.length - 1].charAt(0) : community.name.slice(0, 2)).toUpperCase();
        el("icon").className = "icon";
        el("icon").textContent = initials;
      }
      document.title = (community.name || "Meldiq") + " · Meldiq invitation";
      if (community.description) show("about", community.description);
      // API 0.44.0: the community's banner and accent colour (only "#rrggbb"; anything else keeps Meldiq's colours).
      var accent = /^#[0-9a-f]{6}$/i.test(community.accent || "") ? community.accent : null;
      if (community.banner) {
        el("banner").style.backgroundImage = "url(/v1/invites/" + encodeURIComponent(code) + "/banner)";
        el("banner").hidden = false;
      } else if (accent) {
        el("banner").style.background = accent;
        el("banner").hidden = false;
      }
      if (accent) {
        var n = parseInt(accent.slice(1), 16);
        var lum = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
        var l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
        // White or near-black text, whichever reads better on the accent.
        var onAccent = 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#0b1020";
        el("open-web").style.background = accent;
        el("open-web").style.borderColor = accent;
        el("open-web").style.color = onAccent;
      }
      if (typeof community.memberCount === "number") show("members", community.memberCount === 1 ? "1 member" : community.memberCount + " members");
      if (res.body.invitesPaused) show("problem", "This community has paused new members for now. Try again later.");
      show("join");
    })
    .catch(function () { problem("This invitation can't be opened right now. Check your connection and try again."); });
})();
