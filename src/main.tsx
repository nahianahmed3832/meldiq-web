import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyTheme, getPrefs } from "./app/prefs";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/conversation.css";
import "./styles/views.css";
import "./styles/call.css";
import "./styles/responsive.css"; // last: its media queries override the rest
import { App } from "./ui/App";

applyTheme(getPrefs().theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
