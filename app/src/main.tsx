import React from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./App";
import { LockCountdownOverlay } from "./LockCountdownOverlay";
import "@fontsource-variable/inter";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

const surface = new URLSearchParams(window.location.search).get("surface");

createRoot(root).render(
  <React.StrictMode>
    {surface === "lock-countdown" ? <LockCountdownOverlay /> : <App />}
  </React.StrictMode>,
);
