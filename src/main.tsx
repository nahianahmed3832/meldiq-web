import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme, getPrefs } from "./app/prefs";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/conversation.css";
import "./styles/views.css";
import "./styles/call.css";
import "./styles/community.css";
import "./styles/responsive.css"; // last: its media queries override the rest
import { loadConfig } from "./app/config";
import { App } from "./ui/App";
import { ConfigError } from "./ui/StatusScreens";

applyTheme(getPrefs());

const root = createRoot(document.getElementById("root")!);
try {
  await loadConfig();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  // A deployment mistake (an unreadable config.json): say so rather than talking to the wrong server.
  root.render(<ConfigError message={e instanceof Error ? e.message : "Meldiq Web isn't configured correctly."} />);
}
