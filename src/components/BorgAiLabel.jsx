import React, { useRef } from "react";
import { createPortal } from "react-dom";

// "Borg AI" wordmark for headings. Clicking/tapping it opens the beta disclaimer modal.
// The dialog is portalled out because <dialog> isn't valid inside a heading.
export default function BorgAiLabel() {
  const dialogRef = useRef(null);

  const open = () => {
    if (!dialogRef.current.open) dialogRef.current.showModal();
  };
  const close = () => dialogRef.current.close();

  return (
    <>
      <button type="button" className="ai-brand" aria-haspopup="dialog" onClick={open}>
        Borg AI
      </button>
      {createPortal(
        // Clicks on the backdrop land on the dialog itself; clicks on the label don't.
        <dialog
          ref={dialogRef}
          className="beta-dialog"
          aria-labelledby="beta-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="label beta-label">
            <div className="label-tape" aria-hidden="true" />
            <div className="label-row">
              <span className="label-key">Heads up</span>
              <h2 id="beta-title" className="label-name is-locked">
                BORG AI is in beta
              </h2>
            </div>
            <p>
              It's still early days. The AI can come up with names that miss the mark, make no
              sense or sound a lot like ones we already have, and sometimes it times out or crashes
              outright.
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
      )}
    </>
  );
}
