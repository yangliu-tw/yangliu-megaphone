import * as audio from "./audio-engine.js?v=ad195e34";

import { bindPress } from "./press.js?v=ad195e34";

import { startRecording, isRecordingSupported } from "./recorder.js?v=ad195e34";

import * as storage from "./storage.js?v=ad195e34";

import { openNameDialog } from "./name-dialog.js?v=ad195e34";

import { initScene } from "./scene.js?v=ad195e34";

import { showToast, hideToast } from "./toast.js?v=ad195e34";

import { initInstall, registerServiceWorker } from "./install.js?v=ad195e34";

const PLAY_MODE_KEY = "megaphone-play-mode";

const MIN_RECORDING_MS = 1e3;

const RECORD_HINT = "【任一按鈕長按 5 秒開始錄音，再按一下停止；\n長按 1～5 秒放開可改名。錄音只存在手機中】";

const soundGrid = document.getElementById("sound-grid");

const recordRow = document.getElementById("record-row");

const template = document.getElementById("slot-btn-template");

const modeSwitch = document.getElementById("mode-switch");

const modeSwitchWrap = modeSwitch.closest(".mode-switch");

const slots = new Map;

let loopMode = readPlayMode() === "loop";

let progressFrame = 0;

let recording = null;

init();

async function init() {
  if (!initInstall()) return;
  registerServiceWorker();
  audio.setAudioSessionType("playback");
  storage.requestPersistence();
  initScene(document.querySelector(".gulls"));
  initModeSwitch();
  initUnlock();
  initLifecycle();
  let config;
  try {
    config = await (await fetch("buttons.json?v=ad195e34")).json();
  } catch {
    showToast("無法載入按鈕設定，請重新開啟 App", {
      persistent: true
    });
    return;
  }
  for (const item of config.buttons) soundGrid.append(createSlotButton(item));
  recordRow.prepend(createSlotButton(config.recordButton, {
    wide: true
  }));
  await restoreSaved();
}

function createSlotButton({slot: slot, label: label, maxSeconds: maxSeconds}, {wide: wide = false} = {}) {
  const button = template.content.firstElementChild.cloneNode(true);
  button.dataset.slot = slot;
  if (wide) {
    button.classList.add("record-btn");
    const hint = document.createElement("span");
    hint.className = "record-hint";
    hint.textContent = RECORD_HINT;
    button.querySelector(".btn-main").after(hint);
  }
  const entry = {
    slot: slot,
    defaultLabel: label,
    label: label,
    maxSeconds: maxSeconds,
    hasAudio: false,
    button: button
  };
  slots.set(slot, entry);
  renderLabel(entry);
  entry.press = bindPress(button, {
    onDown: () => handleDown(entry),
    onHoldStart: () => {
      if (audio.currentId() === slot) stopPlayback();
      button.classList.add("is-holding");
    },
    onHoldProgress: ratio => button.style.setProperty("--hold", ratio.toFixed(4)),
    onRenameZone: () => {
      button.classList.add("is-rename-zone");
      showToast("放開可改名，繼續按住開始錄音");
    },
    onTap: () => {
      if (!entry.hasAudio) showToast("長按 5 秒開始錄音");
    },
    onCancel: () => clearHold(entry),
    onRename: () => {
      clearHold(entry);
      hideToast();
      renameSlot(entry, "修改按鈕名稱");
    },
    onRecord: () => {
      clearHold(entry);
      beginRecording(entry);
    }
  });
  return button;
}

function renderLabel(entry, text = entry.label) {
  entry.button.querySelector(".label").textContent = text;
  entry.button.style.setProperty("--chars", (labelWidth(text) + 1.3).toFixed(1));
  entry.button.setAttribute("aria-label", entry.hasAudio ? `播放：${entry.label}` : `${entry.label}（尚未錄音）`);
}

function labelWidth(text) {
  let width = 0;
  for (const ch of text) width += /[\u0000-ÿ]/.test(ch) ? .5 : 1;
  return Math.max(width, 3);
}

function setHasAudio(entry, hasAudio) {
  entry.hasAudio = hasAudio;
  entry.button.classList.toggle("has-audio", hasAudio);
  renderLabel(entry);
}

function clearHold(entry) {
  entry.button.classList.remove("is-holding", "is-rename-zone");
  entry.button.style.setProperty("--hold", 0);
}

function handleDown(entry) {
  if (recording) {
    if (recording.slot === entry.slot) recording.stop();
    return false;
  }
  audio.unlock();
  if (entry.hasAudio) togglePlay(entry.slot);
  return true;
}

function togglePlay(slot) {
  if (loopMode && audio.currentId() === slot) {
    stopPlayback();
    return;
  }
  const started = audio.play(slot, {
    loop: loopMode,
    onEnded: () => setPlayingButton(null)
  });
  if (started) setPlayingButton(slot);
}

function stopPlayback() {
  audio.stopAll();
  setPlayingButton(null);
}

function setPlayingButton(playingSlot) {
  for (const {slot: slot, button: button} of slots.values()) {
    const playing = slot === playingSlot;
    button.classList.toggle("is-playing", playing);
    button.classList.toggle("is-looping", playing && loopMode);
    if (!playing) button.style.setProperty("--progress", 0);
  }
  cancelAnimationFrame(progressFrame);
  if (playingSlot) progressFrame = requestAnimationFrame(updateProgress);
}

function updateProgress() {
  const entry = slots.get(audio.currentId());
  if (!entry) return;
  entry.button.style.setProperty("--progress", audio.progress().toFixed(4));
  progressFrame = requestAnimationFrame(updateProgress);
}

function beginRecording(entry) {
  if (recording) return;
  if (!isRecordingSupported()) {
    showToast("這個瀏覽器不支援錄音，請改用 Safari 或 Chrome 開啟", {
      persistent: true
    });
    return;
  }
  stopPlayback();
  hideToast();
  vibrate(60);
  const {stop: stop, done: done} = startRecording({
    maxSeconds: entry.maxSeconds,
    onStart: () => showRecordingState(entry)
  });
  recording = {
    slot: entry.slot,
    stop: stop,
    countdownTimer: 0
  };
  setRecordingLock(entry.slot);
  done.then(result => finishRecording(entry, result)).catch(error => {
    endRecordingUi(entry);
    showMicError(error);
  });
}

function showRecordingState(entry) {
  const {button: button, maxSeconds: maxSeconds} = entry;
  const countdown = button.querySelector(".countdown");
  const startedAt = performance.now();
  const update = () => {
    const remaining = Math.max(0, Math.ceil(maxSeconds - (performance.now() - startedAt) / 1e3));
    countdown.textContent = String(remaining);
  };
  button.classList.add("is-recording");
  renderLabel(entry, "點一下停止");
  update();
  if (recording) recording.countdownTimer = setInterval(update, 200);
}

function endRecordingUi(entry) {
  if (recording) clearInterval(recording.countdownTimer);
  recording = null;
  entry.button.classList.remove("is-recording");
  renderLabel(entry);
  setRecordingLock(null);
}

async function finishRecording(entry, result) {
  endRecordingUi(entry);
  if (!result) return;
  vibrate([ 40, 60, 40 ]);
  if (result.durationMs < MIN_RECORDING_MS) {
    showToast("錄音太短（不到 1 秒），已保留原本的錄音");
    return;
  }
  const data = await result.blob.arrayBuffer();
  try {
    await storage.saveRecording(entry.slot, {
      data: data,
      mimeType: result.mimeType,
      durationMs: result.durationMs
    });
  } catch {
    showToast("錄音儲存失敗，已保留原本的錄音", {
      persistent: true
    });
    return;
  }
  await loadIntoEngine(entry.slot, data, result.mimeType, result.durationMs);
  setHasAudio(entry, true);
  await renameSlot(entry, "幫這段錄音取個名字");
}

function setRecordingLock(recordingSlot) {
  for (const {slot: slot, button: button} of slots.values()) {
    button.disabled = recordingSlot !== null && slot !== recordingSlot;
  }
  modeSwitch.disabled = recordingSlot !== null;
}

function showMicError(error) {
  const name = error?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    showToast("麥克風權限被拒絕。請到手機「設定」中，允許這個 App（或瀏覽器）使用麥克風後再試一次。", {
      persistent: true
    });
  } else if (name === "NotFoundError") {
    showToast("找不到麥克風，請確認手機麥克風可以使用。", {
      persistent: true
    });
  } else {
    showToast("無法開始錄音，請稍後再試。", {
      persistent: true
    });
  }
}

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

async function renameSlot(entry, title) {
  const name = await openNameDialog({
    title: title,
    value: entry.label
  });
  if (!name || name === entry.label) return;
  try {
    await storage.saveLabel(entry.slot, name);
  } catch {
    showToast("名稱儲存失敗，請再試一次");
    return;
  }
  entry.label = name;
  renderLabel(entry);
}

async function restoreSaved() {
  let records = [];
  try {
    records = await storage.getAllRecords();
  } catch {
    showToast("無法讀取已存的錄音", {
      persistent: true
    });
    return;
  }
  await Promise.all(records.map(async record => {
    const entry = slots.get(record.slot);
    if (!entry) return;
    if (record.label) {
      entry.label = record.label;
      renderLabel(entry);
    }
    if (record.data) {
      await loadIntoEngine(record.slot, record.data, record.mimeType, record.durationMs);
      setHasAudio(entry, true);
    }
  }));
}

async function loadIntoEngine(slot, data, mimeType, durationMs) {
  try {
    audio.setBuffer(slot, await audio.decode(data));
  } catch {
    audio.setFallback(slot, new Blob([ data ], {
      type: mimeType || ""
    }), durationMs / 1e3);
  }
}

function readPlayMode() {
  try {
    return localStorage.getItem(PLAY_MODE_KEY);
  } catch {
    return null;
  }
}

function initModeSwitch() {
  renderModeSwitch();
  modeSwitch.addEventListener("click", () => {
    loopMode = !loopMode;
    try {
      localStorage.setItem(PLAY_MODE_KEY, loopMode ? "loop" : "once");
    } catch {}
    renderModeSwitch();
    if (!loopMode && audio.currentId()) stopPlayback();
  });
}

function renderModeSwitch() {
  modeSwitch.setAttribute("aria-checked", String(loopMode));
  modeSwitchWrap.classList.toggle("is-loop", loopMode);
}

function initUnlock() {
  const onFirstGesture = () => {
    audio.unlock();
    requestWakeLock();
  };
  for (const type of [ "pointerdown", "touchend", "click" ]) {
    document.addEventListener(type, onFirstGesture, {
      capture: true,
      once: true
    });
  }
}

let wakeLock = null;

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {}
}

function initLifecycle() {
  audio.onInterrupted(source => {
    const wasPlaying = Boolean(document.querySelector(".slot-btn.is-playing"));
    setPlayingButton(null);
    const stoppedRecording = source === "session" && recording;
    if (stoppedRecording) recording.stop();
    if ((wasPlaying || stoppedRecording) && !document.hidden) showToast("聲音被系統中斷（例如來電），已停止");
  });
  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("page-hidden", document.hidden);
    if (document.hidden) {
      stopPlayback();
      for (const entry of slots.values()) entry.press?.cancel();
      recording?.stop();
    } else {
      audio.resumeIfNeeded();
      requestWakeLock();
    }
  });
}
