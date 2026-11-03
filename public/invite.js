// The meldiq.app/invite/CODE page (batch B4b): shows which community the invitation is for, using the public preview
// (name, description and size only; never channels or members), and hands the code to the app or Meldiq Web.
// Plain script, no build step: the page must load before the web app and under its Content-Security-Policy.
(function start() {
  "use strict";
  if (!window.meldiqPublicI18n) {
    var localeScript = document.createElement("script");
    localeScript.src = "/public-locale.js";
    localeScript.onload = start;
    localeScript.onerror = function () {
      var error = document.getElementById("public-locale-error");
      if (error) error.hidden = false;
    };
    document.head.appendChild(localeScript);
    return;
  }
  var ui = window.meldiqPublicI18n;
  // Older cached invitation markup can load the current script during a release.
  [
    ["lead", ui.keys.lead],
    ["copy", ui.keys.copy],
    ["open-web", ui.keys.web],
    ["open-app", ui.keys.app],
  ].forEach(function (pair) {
    var node = document.getElementById(pair[0]);
    if (node) ui.label(node, pair[1]);
  });
  var hint = document.querySelector("#join > p");
  if (hint) ui.label(hint, ui.keys.hint);
  var android = document.querySelector("#get-app span");
  if (!android) {
    var link = document.getElementById("get-app");
    if (link) {
      Array.from(link.childNodes).forEach(function (node) {
        if (node.nodeType === 3) node.remove();
      });
      android = document.createElement("span");
      link.appendChild(android);
    }
  }
  if (android) ui.label(android, ui.keys.android);

  var CODE = /^[A-Za-z0-9]{4}(-?[A-Za-z0-9]{4}){2,4}$/;
  var PROBLEMS = {
    invite_not_found: ui.keys.invalid,
    invite_expired: ui.keys.expired,
    invite_revoked: ui.keys.revoked,
    invite_used_up: ui.keys.used,
  };

  function el(id) {
    return document.getElementById(id);
  }
  function show(id, text) {
    var e = el(id);
    if (text !== undefined) e.textContent = text;
    e.hidden = false;
  }

  function showText(id, key, values) {
    ui.label(el(id), key, values);
    el(id).hidden = false;
  }

  function codeFromPath(path) {
    var raw = decodeURIComponent(path.replace(/^\/invite\/?/, "").split("/")[0] || "");
    if (!CODE.test(raw)) return null;
    var plain = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return plain.match(/.{1,4}/g).join("-");
  }

  function problem(key) {
    // Nothing was invited to: no "You've been invited to join" above the reason.
    el("lead").hidden = true;
    ui.label(el("name"), ui.keys.invitation);
    showText("problem", key);
  }

  var code = codeFromPath(window.location.pathname);
  if (!code) {
    problem(PROBLEMS.invite_not_found);
    return;
  }

  el("code").textContent = code;
  // On Android this opens the app when it's installed; App Links usually open it before this page loads at all.
  el("open-app").href = "meldiq://invite/" + encodeURIComponent(code);
  // Meldiq Web keeps the code through signing in and opens the community's preview with Join (src/application/pendingInvite.ts).
  el("open-web").href = "/join/" + encodeURIComponent(code);
  // On Android the app comes first (App Links usually open it before this page loads); elsewhere "Open in the app"
  // can't work, so only the Play Store link is offered beside Meldiq Web.
  if (/Android/i.test(navigator.userAgent)) {
    el("open-app").hidden = false;
    el("open-app").className = "button primary";
    el("open-web").className = "button";
    el("open-app").parentNode.insertBefore(el("open-app"), el("open-web"));
  }
  el("copy").addEventListener("click", function () {
    var done = function () {
      ui.label(el("copy"), ui.keys.copied);
      el("copy").setAttribute("aria-live", "polite");
    };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () {});
  });

  fetch("/v1/invites/" + encodeURIComponent(code) + "/public", { credentials: "omit" })
    .then(function (r) {
      return r.json().then(function (body) {
        return { ok: r.ok, body: body };
      });
    })
    .then(function (res) {
      if (!res.ok) {
        var c = res.body && res.body.error && res.body.error.code;
        problem(Object.hasOwn(PROBLEMS, c) ? PROBLEMS[c] : ui.keys.generic);
        return;
      }
      var community = res.body.community || {};
      if (community.name) {
        el("name").removeAttribute("data-public-text");
        el("name").removeAttribute("data-public-values");
        el("name").textContent = community.name;
      } else ui.label(el("name"), ui.keys.community);
      var initialsIcon = function () {
        // The community's initials on Meldiq's gradient when it has no icon (or it can't load).
        var words = community.name.trim().split(/\s+/);
        el("icon").className = "icon";
        el("icon").textContent = (words.length > 1 ? words[0].charAt(0) + words[words.length - 1].charAt(0) : community.name.slice(0, 2)).toUpperCase();
      };
      if (community.photo) {
        // API 0.46.0: the community's own icon.
        var img = new Image(88, 88);
        img.alt = "";
        img.onload = function () {
          el("icon").className = "icon photo";
          el("icon").replaceChildren(img);
        };
        img.onerror = function () {
          if (community.name) initialsIcon();
        };
        img.src = "/v1/invites/" + encodeURIComponent(code) + "/photo";
      } else if (community.name) initialsIcon();
      document.querySelector("title").removeAttribute("data-public-text");
      var updateTitle = function () {
        document.title = (community.name ? community.name + " · " : "") + ui.text(ui.keys.title);
      };
      updateTitle();
      window.addEventListener("meldiq:public-locale", updateTitle);
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
        var lum = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        var l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
        // White or near-black text, whichever reads better on the accent.
        var onAccent = 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#0b1020";
        el("open-web").style.background = accent;
        el("open-web").style.borderColor = accent;
        el("open-web").style.color = onAccent;
      }
      if (typeof community.memberCount === "number") showText("members", ui.keys.members, { count: community.memberCount });
      if (res.body.invitesPaused) showText("problem", ui.keys.paused);
      show("join");
    })
    .catch(function () {
      problem(ui.keys.generic);
    });
})();
