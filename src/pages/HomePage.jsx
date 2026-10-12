import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useBorgs } from "../context/BorgsContext";
import About from "../components/About";
import AiGenerator from "../components/AiGenerator";
import Borg from "../components/Borg";
import Footer from "../components/Footer";
import Home from "../components/Home";
import Leaderboard from "../components/Leaderboard";
import Marquee from "../components/Marquee";
import NavBar from "../components/Navbar";
import Recipe from "../components/Recipe";
import SubmitBorg from "../components/SubmitBorg";
import { getGeneratorVariant, logGeneratorEvent } from "../lib/generatorExperiment";

// Only the jug group downloads the configurator (its code, CSS and renderer).
const JugConfigurator = lazy(() => import("../components/JugConfigurator"));

// Logs the A/B test's "view" once the generator's top is 40% of the way up the screen, the same
// point for both layouts, so visitors who never scroll down to it don't count.
function useGeneratorView(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          logGeneratorEvent("view");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -40% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
}

export default function HomePage() {
  const { hash } = useLocation();
  const { featured } = useBorgs();
  const [variant] = useState(getGeneratorVariant);
  const generatorRef = useRef(null);
  useGeneratorView(generatorRef);

  // Coming back from /login with a target like "/#ai": jump to that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <>
      <NavBar />
      <main>
        <Home />
        {featured.length > 0 && (
          <Marquee
            className="names"
            items={featured}
            href="#borg"
            label="Generate your own borg name"
          />
        )}
        <About />
        <Recipe />
        {variant === "jug" ? (
          <div ref={generatorRef} className="wrap jug-generators">
            <Suspense fallback={<div className="jug-placeholder" aria-hidden="true" />}>
              <JugConfigurator />
            </Suspense>
          </div>
        ) : (
          <div ref={generatorRef} className="wrap generators">
            <Borg />
            <AiGenerator />
          </div>
        )}
        <SubmitBorg />
        <Leaderboard />
      </main>
      <Footer />
    </>
  );
}
