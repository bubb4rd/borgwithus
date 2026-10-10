import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import data from "../data.json";
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

export default function HomePage() {
  const { hash } = useLocation();

  // Coming back from /login with a target like "/#ai": jump to that section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <>
      <NavBar />
      <main>
        <Home />
        <Marquee
          className="names"
          items={data.featured}
          href="#borg"
          label="Generate your own borg name"
        />
        <About />
        <Recipe />
        <div className="wrap generators">
          <Borg />
          <AiGenerator />
        </div>
        <SubmitBorg />
        <Leaderboard />
      </main>
      <Footer />
    </>
  );
}
