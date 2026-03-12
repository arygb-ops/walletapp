import { initApp } from "./components.js";

window.addEventListener("DOMContentLoaded", () => {
  initApp().catch((err) => {
    console.error("[main] Unhandled initApp error:", err);
  });
});
