import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { I18nProvider } from "./i18n.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider><App /></I18nProvider>
  </React.StrictMode>,
);

// Ask the browser not to evict the career under storage pressure; failure is harmless.
try {
  navigator.storage?.persist?.();
} catch {
  // Unsupported or blocked: the in-game backup reminder still applies.
}
