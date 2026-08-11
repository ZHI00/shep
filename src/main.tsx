import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Suppress the WebView's own context menu ("Reload", "Inspect Element") — it
// isn't part of the app. Runs on bubble so React's own handlers, which build
// the real menus, have already had their turn — the terminal surface builds its
// own copy/paste menu this way. Text fields keep the native cut/copy/paste
// menu, which is a genuine feature.
document.addEventListener("contextmenu", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable='true']")) return;
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
