import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme, getPrefs } from "./application/prefs";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/conversation.css";
import "./styles/views.css";
import "./styles/call.css";
import "./styles/community.css";
import "./styles/motion.css";
import "./styles/responsive.css"; // last: its media queries override the rest
import { loadConfig } from "./application/config";
import { followVisualViewport } from "./application/viewport";
import { hideSplash, startSplash } from "./application/splash";
import { installLegacyCurves } from "./crypto/legacyCurves";
import { App } from "./ui/App";
import { ConfigError } from "./ui/StatusScreens";

applyTheme(getPrefs());
followVisualViewport();
startSplash();

const root = createRoot(document.getElementById("root")!);
try {
  // Safari before 17 (every iPhone 8) has no Ed25519/X25519 in WebCrypto: the fallback fills in before anything signs.
  await installLegacyCurves().catch(() => []);
  await loadConfig();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  // A deployment mistake (an unreadable config.json): say so rather than talking to the wrong server.
  root.render(<ConfigError message={e instanceof Error ? e.message : "Meldiq Web isn't configured correctly."} />);
  hideSplash();
}
