// Standalone SPA entry for the Electron build (no SSR/router needed on desktop).
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import { ConverterApp } from "../../src/components/converter/ConverterApp";

createRoot(document.getElementById("root")!).render(<ConverterApp />);
