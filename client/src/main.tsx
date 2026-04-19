import { createRoot } from "react-dom/client";
import App from "./App";
import { initSentry } from "./lib/sentry";
import "./index.css";
import "./styles/print.css";

initSentry();

createRoot(document.getElementById("root")!).render(<App />);
