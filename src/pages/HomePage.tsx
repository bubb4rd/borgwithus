import { useRef } from "react";
import gsap from "gsap";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import HowTo from "../components/HowTo";
import About from "../components/About";
import Generator from "../components/Generator";
import Contact from "../components/Contact";
import Footer from "../components/Footer";
import ScrollToTop from "../components/ScrollToTop";
import { useGSAP } from "@gsap/react";

export default function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 32,
          autoAlpha: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });
      });
    },
    { scope: rootRef }
  );

  return (
    <div
      ref={rootRef}
      className="site-bg relative min-h-screen overflow-x-hidden"
    >
      <Navbar />
      <main>
        <Hero />
        <HowTo />
        <About />
        <Generator />
        <Contact />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
