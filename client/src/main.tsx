import { createRoot } from "react-dom/client";
import App from "./App";
import { initSentry } from "./lib/sentry";
import { initPostHog } from "./lib/analytics";
import "./index.css";
import "./styles/print.css";

initSentry();
initPostHog();

createRoot(document.getElementById("root")!).render(<App />);
