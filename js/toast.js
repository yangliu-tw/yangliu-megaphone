const AUTO_HIDE_MS = 3e3;

const el = document.getElementById("toast");

const textEl = el.querySelector(".toast-text");

const actionEl = el.querySelector(".toast-action");

const closeEl = el.querySelector(".toast-close");

let hideTimer = 0;

let current = null;

let sticky = null;

actionEl.addEventListener("click", () => {
  const toast = current;
  dismiss(toast);
  toast?.onAction?.();
});

closeEl.addEventListener("click", () => {
  const toast = current;
  dismiss(toast);
  toast?.onClose?.();
});

export function showToast(message, {actionLabel: actionLabel, onAction: onAction, onClose: onClose, persistent: persistent = false} = {}) {
  const toast = {
    message: message,
    actionLabel: actionLabel,
    onAction: onAction,
    onClose: onClose,
    persistent: persistent
  };
  if (persistent) sticky = toast;
  render(toast);
}

export function hideToast() {
  if (current && !current.persistent) dismiss(current);
}

function render(toast) {
  clearTimeout(hideTimer);
  current = toast;
  textEl.textContent = toast.message;
  actionEl.hidden = !toast.actionLabel;
  actionEl.textContent = toast.actionLabel || "";
  closeEl.hidden = !toast.persistent;
  el.classList.add("is-visible");
  if (!toast.persistent) hideTimer = setTimeout(() => dismiss(toast), AUTO_HIDE_MS);
}

function dismiss(toast) {
  if (!toast || current !== toast) return;
  clearTimeout(hideTimer);
  if (toast === sticky) sticky = null;
  current = null;
  el.classList.remove("is-visible");
  if (sticky) render(sticky);
}
