import { showToast } from "./toast.js?v=1f0ac787";

const OFFICIAL_URL = "https://yangliu-tw.github.io/yangliu-megaphone/";

const DISMISS_KEY = "megaphone-install-dismissed-at";

const DISMISS_DAYS = 7;

const GUIDE_DELAY_MS = 2500;

const ua = navigator.userAgent;

const isIos = /iPhone|iPad|iPod/.test(ua) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

const isLine = /Line\//i.test(ua);

const isInAppBrowser = isLine || /FBAN|FBAV|Instagram/i.test(ua);

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true;
}

export function initInstall() {
  if (isInAppBrowser) {
    showInAppBrowserNotice();
    return false;
  }
  if (!isStandalone()) setupInstallGuide();
  return true;
}

function showInAppBrowserNotice() {
  const url = new URL("./", location.href).href;
  const overlay = document.getElementById("inapp-notice");
  overlay.querySelector(".inapp-url").textContent = url;
  overlay.hidden = false;
  const openBtn = overlay.querySelector(".inapp-open");
  if (isLine) {
    const external = new URL(url);
    external.searchParams.set("openExternalBrowser", "1");
    openBtn.href = external.href;
    openBtn.hidden = false;
  }
  const copyBtn = overlay.querySelector(".inapp-copy");
  copyBtn.addEventListener("click", async () => {
    const copied = await copyText(url);
    copyBtn.textContent = copied ? "已複製網址" : "請長按上方網址複製";
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1e3;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

function setupInstallGuide() {
  if (recentlyDismissed()) return;
  if (isIos) {
    setTimeout(() => {
      showToast("安裝到主畫面，離線也能用", {
        actionLabel: "怎麼裝",
        onAction: openIosGuide,
        onClose: rememberDismiss,
        persistent: true
      });
    }, GUIDE_DELAY_MS);
    return;
  }
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    const promptEvent = event;
    showToast("安裝到主畫面，離線也能用", {
      actionLabel: "安裝",
      onAction: async () => {
        promptEvent.prompt();
        const {outcome: outcome} = await promptEvent.userChoice;
        if (outcome !== "accepted") rememberDismiss();
      },
      onClose: rememberDismiss,
      persistent: true
    });
  });
}

function openIosGuide() {
  const dialog = document.getElementById("ios-guide");
  dialog.querySelector(".guide-url").textContent = OFFICIAL_URL;
  dialog.querySelector(".guide-close").onclick = () => {
    dialog.close();
    rememberDismiss();
  };
  dialog.showModal();
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if ([ "localhost", "127.0.0.1" ].includes(location.hostname)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js?v=1f0ac787").then(registration => {
    const watch = worker => {
      if (!worker || !navigator.serviceWorker.controller) return;
      if (worker.state === "installed") {
        promptUpdate(worker);
        return;
      }
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") promptUpdate(worker);
      });
    };
    watch(registration.waiting || registration.installing);
    registration.addEventListener("updatefound", () => watch(registration.installing));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) registration.update().catch(() => {});
    });
  }).catch(() => {});
}

function promptUpdate(worker) {
  showToast("有新版本", {
    actionLabel: "更新",
    onAction: () => worker.postMessage({
      type: "SKIP_WAITING"
    }),
    persistent: true
  });
}
