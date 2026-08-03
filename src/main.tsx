import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
