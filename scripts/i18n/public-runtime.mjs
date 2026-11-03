/* global window, document, localStorage, navigator, CustomEvent */
/** Serialized into one same-origin script for the standalone invite and OAuth return pages. */
export function publicLocaleRuntime(data) {
  "use strict";
  const cache = { en: data.english };
  let locale = "en",
    dictionary = data.english,
    revision = 0,
    busy = false;
  function match(raw) {
    const tag = String(raw || "")
      .trim()
      .replaceAll("_", "-")
      .toLowerCase();
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(tag)) return null;
    const exact = data.locales.find((code) => code.toLowerCase() === tag);
    if (exact) return exact;
    const parts = tag.split("-"),
      base = parts[0];
    if (base === "zh") return parts.includes("hant") || (!parts.includes("hans") && parts.some((p) => ["tw", "hk", "mo"].includes(p))) ? "zh-TW" : "zh-CN";
    if (base === "pt") return parts.includes("br") ? "pt-BR" : "pt-PT";
    if (base === "es") return parts.length === 1 || parts.slice(1).includes("es") ? "es-ES" : "es-419";
    return data.locales.includes(base) ? base : null;
  }
  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }
  function initial() {
    const look = read("meldiq.look");
    if (data.locales.includes(look?.language)) return look.language;
    const guest = read("meldiq.locale.guest");
    if (data.locales.includes(guest)) return guest;
    const previous = read("orbit.prefs.v1");
    if (data.locales.includes(previous?.language)) return previous.language;
    for (const tag of navigator.languages || []) {
      const found = match(tag);
      if (found) return found;
    }
    return "en";
  }
  function text(key, values = {}) {
    const entry = dictionary[key] || data.english[key];
    if (!entry) return key;
    let parts = entry.parts,
      count = Number(values[entry.argument]);
    if (entry.kind === "plural") parts = entry.options["=" + count] || entry.options[new Intl.PluralRules(locale).select(count)] || entry.options.other;
    return parts
      .map((part) => {
        if (typeof part === "string") return part;
        const value = part.pound ? count : values[part.argument];
        return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : value == null ? "" : String(value);
      })
      .join("");
  }
  function render() {
    for (const node of document.querySelectorAll("[data-public-text]")) {
      let values = {};
      try {
        values = JSON.parse(node.dataset.publicValues || "{}");
      } catch {
        /* Ignore malformed page metadata. */
      }
      node.textContent = text(node.dataset.publicText, values);
    }
    for (const select of document.querySelectorAll("[data-public-language]")) {
      if (!select.options.length)
        for (const code of data.locales) {
          const option = document.createElement("option");
          option.value = code;
          option.textContent = data.names[code];
          option.lang = code;
          option.dir = ["ar", "ur"].includes(code) ? "rtl" : "ltr";
          select.append(option);
        }
      select.value = locale;
      select.disabled = busy;
      select.setAttribute("aria-label", text(data.keys.language));
      select.setAttribute("aria-busy", String(busy));
      if (!select.dataset.publicBound) {
        select.dataset.publicBound = "1";
        select.addEventListener("change", () => void choose(select.value, true));
      }
    }
  }
  function label(node, key, values = {}) {
    node.dataset.publicText = key;
    node.dataset.publicValues = JSON.stringify(values);
    node.textContent = text(key, values);
  }
  async function choose(requested, persist = false) {
    if (!data.locales.includes(requested)) return false;
    const mine = ++revision;
    busy = true;
    render();
    try {
      let next = cache[requested];
      if (!next) {
        const response = await fetch(data.files[requested], { credentials: "omit", cache: "force-cache", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("locale asset unavailable");
        next = await response.json();
        if (!Object.keys(data.english).every((key) => next[key] && ["text", "plural"].includes(next[key].kind))) throw new Error("invalid locale asset");
      }
      if (mine !== revision) return false;
      locale = requested;
      dictionary = next;
      cache[requested] = next;
      document.documentElement.lang = locale;
      document.documentElement.dir = ["ar", "ur"].includes(locale) ? "rtl" : "ltr";
      if (persist)
        try {
          localStorage.setItem("meldiq.locale.guest", JSON.stringify(locale));
          localStorage.setItem("meldiq.look", JSON.stringify({ ...read("meldiq.look"), language: locale }));
          localStorage.setItem("orbit.prefs.v1", JSON.stringify({ ...read("orbit.prefs.v1"), language: locale }));
        } catch {
          /* In-memory selection still works. */
        }
      const error = document.getElementById("public-locale-error");
      if (error) error.hidden = true;
      window.dispatchEvent(new CustomEvent("meldiq:public-locale"));
      return true;
    } catch {
      if (mine === revision) {
        const error = document.getElementById("public-locale-error");
        if (error) {
          label(error, data.keys.failed);
          error.hidden = false;
        }
      }
      return false;
    } finally {
      if (mine === revision) {
        busy = false;
        render();
      }
    }
  }
  window.meldiqPublicI18n = {
    text,
    label,
    render,
    choose,
    match,
    keys: data.keys,
    get locale() {
      return locale;
    },
  };
  render();
  void choose(initial());
}
