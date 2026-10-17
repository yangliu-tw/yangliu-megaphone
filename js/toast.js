const AUTO_HIDE_MS = 3e3;

const el = document.getElementById("toast");

const textEl = el.querySelector(".toast-text");

const actionEl = el.querySelector(".toast-action");

const closeEl = el.querySelector(".toast-close");

let hideTimer = 0;

let onAction = null;

let onClose = null;

actionEl.addEventListener("click", () => {
  const handler = onAction;
  hideToast();
  handler?.();
});

closeEl.addEventListener("click", () => {
  const handler = onClose;
  hideToast();
  handler?.();
});

export function showToast(message, {actionLabel: actionLabel, onAction: action, onClose: close, persistent: persistent = false} = {}) {
  clearTimeout(hideTimer);
  textEl.textContent = message;
  onAction = action || null;
  onClose = close || null;
  actionEl.hidden = !actionLabel;
  actionEl.textContent = actionLabel || "";
  closeEl.hidden = !persistent;
  el.classList.add("is-visible");
  if (!persistent) hideTimer = setTimeout(hideToast, AUTO_HIDE_MS);
}

export function hideToast() {
  clearTimeout(hideTimer);
  el.classList.remove("is-visible");
  onAction = null;
  onClose = null;
}
