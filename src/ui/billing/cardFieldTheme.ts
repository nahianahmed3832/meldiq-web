import type { CardFieldOptions } from "@paypal/paypal-js/sdk-v6";
/** Resolve the app palette to concrete values; CSS variables cannot cross a hosted iframe boundary. */
export function cardFieldTheme(): CardFieldOptions["style"] {
  const surface = document.createElement("span");
  surface.style.cssText = "color:var(--text);background:var(--surface);position:fixed;visibility:hidden";
  document.body.append(surface);
  const computed = getComputedStyle(surface);
  const color = computed.color;
  const background = computed.backgroundColor;
  surface.remove();
  return {
    input: { color, background, fontFamily: "system-ui, sans-serif", fontSize: "16px", padding: "8px", border: "none" },
    "input::placeholder": { color, opacity: "0.6" },
    label: { color, fontSize: "12px" },
  };
}
