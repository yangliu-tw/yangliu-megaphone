export const MAX_NAME_LENGTH = 8;

const dialog = document.getElementById("name-dialog");

const form = dialog.querySelector("form");

const titleEl = dialog.querySelector(".name-title");

const input = dialog.querySelector(".name-input");

const countEl = dialog.querySelector(".name-count-value");

const cancelBtn = dialog.querySelector(".name-cancel");

input.maxLength = MAX_NAME_LENGTH;

let resolveCurrent = null;

function updateCount() {
  countEl.textContent = String([ ...input.value ].length);
}

function finish(value) {
  const resolve = resolveCurrent;
  resolveCurrent = null;
  if (dialog.open) dialog.close();
  resolve?.(value);
}

input.addEventListener("input", updateCount);

form.addEventListener("submit", event => {
  event.preventDefault();
  const name = input.value.trim();
  finish(name ? [ ...name ].slice(0, MAX_NAME_LENGTH).join("") : null);
});

cancelBtn.addEventListener("click", () => finish(null));

dialog.addEventListener("cancel", event => {
  event.preventDefault();
  finish(null);
});

export function isNameDialogOpen() {
  return dialog.open;
}

export function openNameDialog({title: title, value: value}) {
  if (resolveCurrent) finish(null);
  titleEl.textContent = title;
  input.value = value;
  updateCount();
  dialog.showModal();
  input.focus();
  input.select();
  return new Promise(resolve => {
    resolveCurrent = resolve;
  });
}
