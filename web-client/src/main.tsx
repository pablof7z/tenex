console.log("Starting main.tsx");
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
// import AppMinimal from "./AppMinimal.tsx";
// import AppTest from "./AppTest.tsx";
import "./lib/ndk-setup";

console.log("Imports completed");

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
                console.log("SW registered: ", registration);
            })
            .catch((registrationError) => {
                console.log("SW registration failed: ", registrationError);
            });
    });
}

console.log("About to render App");
const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
