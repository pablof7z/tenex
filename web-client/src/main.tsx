import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
// import AppMinimal from "./AppMinimal.tsx";
// import AppTest from "./AppTest.tsx";
import "./lib/ndk-setup";

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then(() => {
                // Service worker registered successfully
            })
            .catch(() => {
                // Service worker registration failed
            });
    });
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
