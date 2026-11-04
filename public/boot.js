/*
 * Runs before the first paint (src/pages/_document.tsx), so a reload or a return looks like an app reopening rather than
 * a website loading (2026-10-29): the theme and palette this browser last showed (src/application/prefs.ts writes them,
 * already checked, as "meldiq.look"), and, when Meldiq was signed in here last time ("meldiq.returning",
 * src/application/splash.ts), the app's frame with skeletons instead of the launch screen. Nothing else is read, and it
 * never touches messages or keys. A plain script, as the page's Content-Security-Policy allows ('self'), with no build.
 */
(function () {
  try {
    var root = document.documentElement;
    var look = JSON.parse(localStorage.getItem("meldiq.look") || "null");
    var locales = [
      "en",
      "bn",
      "hi",
      "ur",
      "zh-CN",
      "zh-TW",
      "ja",
      "ko",
      "id",
      "vi",
      "th",
      "ar",
      "tr",
      "pt-BR",
      "es-419",
      "es-ES",
      "fr",
      "de",
      "it",
      "nl",
      "pl",
      "ru",
      "uk",
      "ro",
      "sv",
      "cs",
      "el",
      "pt-PT",
    ];
    if (look && locales.indexOf(look.language) !== -1) {
      root.setAttribute("lang", look.language);
      root.setAttribute("dir", look.language === "ar" || look.language === "ur" ? "rtl" : "ltr");
    }
    if (look && (look.theme === "light" || look.theme === "dark")) root.setAttribute("data-theme", look.theme);
    var palettes = ["meldiq", "midnight", "charcoal", "indigo", "plum", "amber"];
    if (look && palettes.indexOf(look.palette) !== -1) {
      var chosen = look.paletteChosen === true;
      // Older first-paint caches omitted this choice flag. Consult only the browser's presentation preferences.
      if (look.palette === "midnight" && !chosen) {
        var prefs = JSON.parse(localStorage.getItem("orbit.prefs.v1") || "null");
        chosen = !!prefs && prefs.palette === "midnight" && prefs.paletteChosen === true;
      }
      root.setAttribute("data-palette", look.palette === "midnight" && !chosen ? "meldiq" : look.palette);
    }
    if (localStorage.getItem("meldiq.returning") === "1") root.setAttribute("data-boot", "app");
  } catch (e) {
    /* storage unavailable: the launch screen, as before */
  }
})();
