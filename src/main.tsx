import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import "./index.css";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollToPlugin);

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
