import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  (window as any).global = window;
  (window as any).Buffer = Buffer;
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
