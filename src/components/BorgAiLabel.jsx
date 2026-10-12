import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";

// The BORG AI beta disclaimer as a modal: `dialog` goes anywhere in the tree (it's portalled to
// <body>, since <dialog> isn't valid inside a heading) and `open` shows it. Used by the "Borg AI"
// heading wordmark and the jug configurator's "Learn more about BORG AI".
export function useBorgAiBeta() {
  const dialogRef = useRef(null);
  const titleId = useId();

  const open = () => {
    if (!dialogRef.current.open) dialogRef.current.showModal();
  };
  const close = () => dialogRef.current.close();

  const dialog = createPortal(
    // Clicks on the backdrop land on the dialog itself; clicks on the label don't.
    <dialog
      ref={dialogRef}
      className="beta-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="label beta-label">
        <div className="label-tape" aria-hidden="true" />
        <div className="label-row">
          <span className="label-key">Heads up</span>
          <h2 id={titleId} className="label-name is-locked">
            BORG AI is in beta
          </h2>
        </div>
        <p>
          It's still early days. The AI can come up with names that miss the mark, make no sense or
          sound a lot like ones we already have, and sometimes it times out or crashes outright.
        </p>
        <p>If it comes up empty, your credit is refunded. Keep the good ones, roll past the rest.</p>
        <div className="label-actions">
          <button type="button" className="btn btn-ink" onClick={close} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );

  return { open, dialog };
}

// "Borg AI" wordmark for headings. Clicking/tapping it opens the beta disclaimer modal.
export default function BorgAiLabel() {
  const { open, dialog } = useBorgAiBeta();

  return (
    <>
      <button type="button" className="ai-brand" aria-haspopup="dialog" onClick={open}>
        Borg AI
      </button>
      {dialog}
    </>
  );
}
