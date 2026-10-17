export const HOLD_START_MS = 500;

export const RENAME_MS = 3e3;

export const RECORD_MS = 5e3;

export function bindPress(button, handlers) {
  let pointerId = null;
  let downAt = 0;
  let frame = 0;
  let timers = [];
  let holding = false;
  let inRenameZone = false;
  const reset = () => {
    cancelAnimationFrame(frame);
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    pointerId = null;
    holding = false;
    inRenameZone = false;
    button.classList.remove("is-pressed");
  };
  const drawProgress = () => {
    if (!holding) return;
    handlers.onHoldProgress?.(Math.min(1, (performance.now() - downAt) / RECORD_MS));
    frame = requestAnimationFrame(drawProgress);
  };
  const startTimers = () => {
    timers = [ setTimeout(() => {
      holding = true;
      handlers.onHoldStart?.();
      drawProgress();
    }, HOLD_START_MS), setTimeout(() => {
      inRenameZone = true;
      handlers.onRenameZone?.();
    }, RENAME_MS), setTimeout(() => {
      reset();
      handlers.onRecord?.();
    }, RECORD_MS) ];
  };
  const end = kind => {
    if (pointerId === null) return;
    const wasHolding = holding;
    const renameZone = inRenameZone;
    reset();
    if (kind === "cancel") {
      if (wasHolding) handlers.onCancel?.();
    } else if (renameZone) {
      handlers.onRename?.();
    } else if (wasHolding) {
      handlers.onCancel?.();
    } else {
      handlers.onTap?.();
    }
  };
  button.addEventListener("pointerdown", event => {
    if (event.button !== 0 || pointerId !== null) return;
    event.preventDefault();
    button.classList.add("is-pressed");
    if (handlers.onDown?.() === false) {
      const release = () => button.classList.remove("is-pressed");
      button.addEventListener("pointerup", release, {
        once: true
      });
      button.addEventListener("pointercancel", release, {
        once: true
      });
      return;
    }
    pointerId = event.pointerId;
    downAt = performance.now();
    try {
      button.setPointerCapture(event.pointerId);
    } catch {}
    startTimers();
  });
  button.addEventListener("pointerup", event => {
    if (event.pointerId === pointerId) end("release");
  });
  button.addEventListener("pointercancel", event => {
    if (event.pointerId === pointerId) end("cancel");
  });
  button.addEventListener("pointermove", event => {
    if (event.pointerId !== pointerId) return;
    const rect = button.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) end("cancel");
  });
  button.addEventListener("click", event => {
    if (event.detail !== 0) return;
    if (handlers.onDown?.() === false) return;
    handlers.onTap?.();
  });
  button.addEventListener("contextmenu", event => event.preventDefault());
  return {
    cancel: () => end("cancel")
  };
}
