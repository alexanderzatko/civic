import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CivicMockup from "./CivicMockup";
import { CanvasRoot } from "cursor/canvas";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CanvasRoot>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px", background: "#181818", minHeight: "100vh", color: "#E4E4E4EB" }}>
        <CivicMockup />
      </div>
    </CanvasRoot>
  </StrictMode>,
);
