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
    if (look && (look.theme === "light" || look.theme === "dark")) root.setAttribute("data-theme", look.theme);
    if (look && typeof look.palette === "string" && /^[a-z0-9-]{1,32}$/.test(look.palette)) root.setAttribute("data-palette", look.palette);
    if (localStorage.getItem("meldiq.returning") === "1") root.setAttribute("data-boot", "app");
  } catch (e) {
    /* storage unavailable: the launch screen, as before */
  }
})();
