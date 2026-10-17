const LOOP_GAP = .5;

let ctx = null;

let output = null;

const buffers = new Map;

const fallbacks = new Map;

let current = null;

function getContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx({
      latencyHint: "interactive"
    });
    output = ctx.createGain();
    output.connect(ctx.destination);
    ctx.addEventListener("statechange", () => {
      if (ctx.state !== "running" && document.visibilityState === "visible") {
        ctx.resume().catch(() => {});
      }
    });
  }
  return ctx;
}

export function setAudioSessionType(type) {
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = type;
    } catch {}
  }
}

export function unlock() {
  const c = getContext();
  if (c.state !== "running") c.resume().catch(() => {});
}

export function decode(arrayBuffer) {
  return getContext().decodeAudioData(arrayBuffer.slice(0));
}

export function setBuffer(id, buffer) {
  clearSound(id);
  buffers.set(id, buffer);
}

export function setFallback(id, blob, duration) {
  clearSound(id);
  fallbacks.set(id, {
    url: URL.createObjectURL(blob),
    duration: duration
  });
}

function clearSound(id) {
  if (currentId() === id) stopAll();
  buffers.delete(id);
  const fallback = fallbacks.get(id);
  if (fallback) URL.revokeObjectURL(fallback.url);
  fallbacks.delete(id);
}

export function hasSound(id) {
  return buffers.has(id) || fallbacks.has(id);
}

export function play(id, {loop: loop = false, onEnded: onEnded} = {}) {
  if (fallbacks.has(id)) return playFallback(id, loop, onEnded);
  const buffer = buffers.get(id);
  if (!buffer) return false;
  const c = getContext();
  if (c.state !== "running") c.resume().catch(() => {});
  stopAll();
  current = {
    id: id,
    buffer: buffer,
    loop: loop,
    rounds: [],
    onEnded: onEnded
  };
  scheduleRound(current, c.currentTime);
  return true;
}

function scheduleRound(playback, startAt) {
  const node = ctx.createBufferSource();
  node.buffer = playback.buffer;
  node.connect(output);
  node.start(startAt);
  const round = {
    node: node,
    startAt: startAt
  };
  playback.rounds.push(round);
  if (playback.loop) {
    if (playback.rounds.length === 1) {
      scheduleRound(playback, startAt + playback.buffer.duration + LOOP_GAP);
    }
    node.onended = () => {
      if (current !== playback) return;
      playback.rounds = playback.rounds.filter(r => r !== round);
      const last = playback.rounds[playback.rounds.length - 1];
      if (last) scheduleRound(playback, last.startAt + playback.buffer.duration + LOOP_GAP);
    };
  } else {
    node.onended = () => {
      if (current !== playback) return;
      current = null;
      playback.onEnded?.();
    };
  }
}

function playFallback(id, loop, onEnded) {
  stopAll();
  const {url: url, duration: duration} = fallbacks.get(id);
  const element = new Audio(url);
  const playback = {
    id: id,
    element: element,
    duration: duration,
    loop: loop,
    gapTimer: 0,
    onEnded: onEnded
  };
  current = playback;
  element.addEventListener("ended", () => {
    if (current !== playback) return;
    if (loop) {
      playback.gapTimer = setTimeout(() => {
        if (current !== playback) return;
        element.currentTime = 0;
        element.play().catch(() => {});
      }, LOOP_GAP * 1e3);
    } else {
      current = null;
      onEnded?.();
    }
  });
  element.play().catch(() => {});
  return true;
}

export function stopAll() {
  if (!current) return;
  const playback = current;
  current = null;
  if (playback.element) {
    clearTimeout(playback.gapTimer);
    playback.element.pause();
    return;
  }
  for (const {node: node} of playback.rounds) {
    node.onended = null;
    try {
      node.stop();
    } catch {}
    node.disconnect();
  }
}

export function currentId() {
  return current ? current.id : null;
}

export function progress() {
  if (!current) return 0;
  if (current.element) {
    const {element: element, duration: duration, loop: loop} = current;
    if (element.ended) return loop ? 1 : 0;
    return Math.min(1, element.currentTime / (duration || element.duration || 1));
  }
  const now = ctx.currentTime;
  const started = current.rounds.filter(r => r.startAt <= now);
  const round = started[started.length - 1];
  if (!round) return current.loop ? 1 : 0;
  const elapsed = now - round.startAt;
  return Math.min(1, Math.max(0, elapsed / current.buffer.duration));
}

export function resumeIfNeeded() {
  if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
}
