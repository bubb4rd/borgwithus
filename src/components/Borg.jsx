import React from "react";
import { useState, useEffect } from "react";
import data from "../data.json";

export default function Borg() {
  const [currBorg, setCurrBorg] = useState("Click the button!");
  const [mio, setMio] = useState("Click the button!");
  useEffect(() => {}, []);
  function borg() {
    let array = data.borgs;
    var copy = array.slice(0);
    if (copy.length < 1) copy = array.slice(0);
    var index = Math.floor(Math.random() * copy.length);
    var item = copy[index];
    copy.splice(index, 1);
    setCurrBorg(item);
  }
  function m() {
    let array = data.mio;
    var copy = array.slice(0);
    if (copy.length < 1) copy = array.slice(0);
    var index = Math.floor(Math.random() * copy.length);
    var item = copy[index];
    copy.splice(index, 1);
    setMio(item);
  }
  return (
    <div id="borg">
      <div className="b-container">
        <h1>Let's borg.</h1>
        <p>Please drink responsibly.</p>
        <div className="c-container">
          <button className="borg-button" id="borg-button" onClick={borg}>
            BORG!
          </button>
          <div className="borg-box">
            <p className="borg-name" id="borg-name">
              {currBorg}
            </p>
          </div>
        </div>
        <div className="c-container">
          <button className="mio-button" id="mio-button" onClick={m}>
            MIO
          </button>
          <div className="borg-box">
            <p className="mio-name" id="mio-name">
              {mio}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
