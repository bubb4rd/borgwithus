import React from "react";

// Four identical copies; the track slides by exactly one copy (-25%) so the
// loop seam is invisible. Copies 2-4 are hidden from assistive tech.
const COPIES = 4;

export default function Marquee({ items, className = "", href, label, separator = "✦" }) {
  const Tag = href ? "a" : "div";
  return (
    <Tag className={`marquee ${className}`} href={href} aria-label={label}>
      <div className="marquee-track">
        {Array.from({ length: COPIES }, (_, copy) => (
          <ul className="marquee-copy" key={copy} aria-hidden={copy > 0 || Boolean(label)}>
            {items.map((item) => (
              <li className="marquee-item" key={item}>
                <span>{item}</span>
                <span className="marquee-sep" aria-hidden="true">
                  {separator}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </Tag>
  );
}
