const GULLS = [ {
  src: "assets/images/seagull_3.png",
  width: 33,
  height: 17.33,
  box: {
    x: -86.67,
    y: 7,
    width: 40,
    height: 39.67
  }
}, {
  src: "assets/images/seagull_1.png",
  width: 23.67,
  height: 23.33,
  box: {
    x: -108.67,
    y: 52.33,
    width: 40,
    height: 39.67
  }
}, {
  src: "assets/images/seagull_2.png",
  width: 64,
  height: 33,
  box: {
    x: 43.33,
    y: 3.67,
    width: 79.33,
    height: 48
  }
}, {
  src: "assets/images/seagull_4.png",
  width: 30,
  height: 17,
  box: {
    x: 82.67,
    y: 64.67,
    width: 40,
    height: 39.67
  }
} ];

const MIN_MOVE_MS = 2e3;

const MAX_MOVE_MS = 4e3;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function initScene(container) {
  const gulls = GULLS.map(config => {
    const img = document.createElement("img");
    img.className = "gull";
    img.src = config.src;
    img.alt = "";
    img.draggable = false;
    img.style.width = `${config.width}px`;
    img.style.height = `${config.height}px`;
    img.style.left = `calc(50% + ${config.box.x}px)`;
    img.style.top = `${config.box.y}px`;
    container.append(img);
    const gull = {
      config: config,
      img: img,
      timer: 0
    };
    moveTo(gull, randomPoint(config), 0);
    img.addEventListener("transitionend", () => scheduleNext(gull));
    return gull;
  });
  const start = () => {
    if (reducedMotion.matches || document.hidden) return;
    for (const gull of gulls) scheduleNext(gull, Math.random() * 600);
  };
  const stop = () => {
    for (const gull of gulls) clearTimeout(gull.timer);
  };
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  reducedMotion.addEventListener("change", () => {
    stop();
    start();
  });
  start();
}

function scheduleNext(gull, delay = 0) {
  clearTimeout(gull.timer);
  if (reducedMotion.matches || document.hidden) return;
  gull.timer = setTimeout(() => {
    const duration = MIN_MOVE_MS + Math.random() * (MAX_MOVE_MS - MIN_MOVE_MS);
    moveTo(gull, randomPoint(gull.config), duration);
  }, delay);
}

function randomPoint({width: width, height: height, box: box}) {
  return {
    x: Math.random() * Math.max(0, box.width - width),
    y: Math.random() * Math.max(0, box.height - height)
  };
}

function moveTo({img: img}, {x: x, y: y}, duration) {
  img.style.transitionDuration = `${duration}ms`;
  img.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
}
