const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const trashLeftEl = document.getElementById("trashLeft");
const roundEl = document.getElementById("round");
const messageEl = document.getElementById("message");
const startButton = document.getElementById("startButton");
const infoOverlay = document.getElementById("infoOverlay");
const infoTitle = document.getElementById("infoTitle");
const infoBody = document.getElementById("infoBody");
const infoSmall = document.getElementById("infoSmall");
const continueButton = document.getElementById("continueButton");

const headSize = 88;
const bodySize = 78;
const moveSpeed = 185;
const bodySpacing = 58;
const baseTrashCount = 18;
const trashIncreasePerRound = 4;

// Bigger trash: roughly 2x the previous scale.
const trashSizes = {
  small: 108,
  medium: 152,
  large: 208,
};

const trashAssets = [
  { src: "assets/straw.png", category: "small", label: "straw" },
  { src: "assets/can.png", category: "small", label: "can" },
  { src: "assets/wrapper.png", category: "small", label: "wrapper" },
  { src: "assets/bottle_cap.png", category: "small", label: "bottle cap" },
  { src: "assets/cup.png", category: "medium", label: "cup" },
  { src: "assets/bottle.png", category: "medium", label: "bottle" },
  { src: "assets/carton.png", category: "medium", label: "carton" },
  { src: "assets/toothbrush.png", category: "medium", label: "toothbrush" },
  { src: "assets/plastic_bag.png", category: "large", label: "plastic bag" },
  { src: "assets/fishing_net.png", category: "large", label: "fishing net" },
  { src: "assets/foam_box.png", category: "large", label: "foam box" },
  { src: "assets/rope_coil.png", category: "large", label: "rope coil" },
];

const oceanFacts = [
  {
    title: "Plastic does not really disappear.",
    body: "Many plastic items break into smaller and smaller pieces called microplastics. These fragments can move through water, sand, and food chains, making them much harder to remove than a whole bottle or bag.",
    small: "Design note: the snake grows because every collected object leaves a trace behind.",
  },
  {
    title: "Most ocean waste starts on land.",
    body: "Trash does not have to be thrown directly into the sea to reach it. Wind, rain, rivers, drainage systems, and poorly managed waste can carry everyday packaging from cities to the ocean.",
    small: "Design note: the ocean is connected to ordinary daily life, not only beaches and vacations.",
  },
  {
    title: "Ghost gear keeps catching life.",
    body: "Abandoned fishing nets, lines, and traps are often called ghost gear. They can continue drifting and entangling marine animals long after people stop using them.",
    small: "Design note: large trash in the game can represent objects that are harder to remove.",
  },
  {
    title: "Clean-up is helpful, but prevention matters more.",
    body: "Collecting waste is important, but reducing single-use items, reusing materials, and improving waste systems can prevent trash from reaching water in the first place.",
    small: "Design note: finishing a level is not the end — the next round reminds us the problem keeps returning.",
  },
  {
    title: "Small objects still matter.",
    body: "Bottle caps, wrappers, straws, and fragments may look minor, but they can be mistaken for food or become part of microplastic pollution.",
    small: "Design note: small trash is easy to miss, but it still counts.",
  },
];

const loadedTrashAssets = [];
let loadedImages = 0;
let gameWidth = 0;
let gameHeight = 0;
let snake = [];
let pathPoints = [];
let direction = { x: 0, y: 0 };
let pressedKeys = new Set();
let trashItems = [];
let score = 0;
let round = 1;
let gameStarted = false;
let cleanupComplete = false;
let showingInfo = false;
let animationTime = 0;
let lastFrameTime = 0;
let animationFrameId = null;

trashAssets.forEach((asset) => {
  const img = new Image();
  img.src = asset.src;
  img.onload = () => {
    loadedImages++;
    if (loadedImages === trashAssets.length && !animationFrameId) {
      lastFrameTime = performance.now();
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  };
  loadedTrashAssets.push({ ...asset, img, size: trashSizes[asset.category] });
});

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gameWidth = window.innerWidth;
  gameHeight = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function startFreshGame() {
  round = 1;
  startRound();
}

function startRound() {
  const startX = gameWidth / 2;
  const startY = gameHeight / 2;
  snake = [{ x: startX, y: startY, img: null }];
  pathPoints = [{ x: startX, y: startY }];
  direction = { x: 0, y: 0 };
  pressedKeys.clear();
  score = 0;
  cleanupComplete = false;
  showingInfo = false;
  gameStarted = true;
  infoOverlay.classList.add("hidden");
  scoreEl.textContent = score;
  roundEl.textContent = round;
  messageEl.textContent = "Hold a direction key to begin cleaning.";
  createTrashField();
  lastFrameTime = performance.now();
}

function getTrashCountForRound() {
  return baseTrashCount + (round - 1) * trashIncreasePerRound;
}

function getRandomTrashAsset() {
  return loadedTrashAssets[Math.floor(Math.random() * loadedTrashAssets.length)];
}

function createTrashField() {
  trashItems = [];
  for (let i = 0; i < getTrashCountForRound(); i++) placeOneTrash();
  updateTrashLeft();
}

function placeOneTrash() {
  let tries = 0;
  while (tries < 800) {
    tries++;
    const asset = getRandomTrashAsset();
    const size = asset.size;
    const margin = size / 2 + 18;
    const item = {
      x: margin + Math.random() * Math.max(1, gameWidth - margin * 2),
      y: margin + Math.random() * Math.max(1, gameHeight - margin * 2),
      size,
      category: asset.category,
      label: asset.label,
      img: asset.img,
      rotation: Math.random() * Math.PI * 2,
      bobOffset: Math.random() * Math.PI * 2,
    };

    // Leave room for the compact top-left UI.
    if (item.x < 310 && item.y < 190) continue;
    if (snake.length > 0 && Math.hypot(item.x - snake[0].x, item.y - snake[0].y) < 210) continue;

    const overlapsTrash = trashItems.some(
      (trash) => Math.hypot(trash.x - item.x, trash.y - item.y) < (trash.size + item.size) / 2 + 30
    );
    if (overlapsTrash) continue;

    trashItems.push(item);
    return;
  }
}

function updateTrashLeft() {
  trashLeftEl.textContent = trashItems.length;
}

function gameLoop(now) {
  const dt = Math.min((now - lastFrameTime) / 1000, 0.04);
  lastFrameTime = now;
  if (gameStarted && !cleanupComplete && !showingInfo) update(dt);
  draw();
  if (!gameStarted) drawIdleScreenText();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  updateDirectionFromKeys();
  const isMoving = direction.x !== 0 || direction.y !== 0;

  if (isMoving) {
    const head = snake[0];
    let nextX = head.x + direction.x * moveSpeed * dt;
    let nextY = head.y + direction.y * moveSpeed * dt;
    const radius = headSize / 2;
    let hitWall = false;

    if (nextX < radius) {
      nextX = radius;
      hitWall = true;
    } else if (nextX > gameWidth - radius) {
      nextX = gameWidth - radius;
      hitWall = true;
    }

    if (nextY < radius) {
      nextY = radius;
      hitWall = true;
    } else if (nextY > gameHeight - radius) {
      nextY = gameHeight - radius;
      hitWall = true;
    }

    head.x = nextX;
    head.y = nextY;

    if (hitWall) {
      direction = { x: 0, y: 0 };
      pressedKeys.clear();
      messageEl.textContent = "You reached the edge. Choose another direction.";
    }

    recordPathPoint(head.x, head.y);
    updateBodyPositions();
  } else {
    updateBodyPositions();
  }

  checkTrashCollection();

  if (trashItems.length === 0 && !cleanupComplete) {
    cleanupComplete = true;
    messageEl.textContent = "Round complete. Read the ocean waste note.";
    showOceanInfoScreen();
  }
}

function showOceanInfoScreen() {
  showingInfo = true;
  pressedKeys.clear();
  direction = { x: 0, y: 0 };
  const fact = oceanFacts[(round - 1) % oceanFacts.length];
  infoTitle.textContent = fact.title;
  infoBody.textContent = fact.body;
  infoSmall.textContent = fact.small;
  continueButton.textContent = `Continue to Round ${round + 1}`;
  infoOverlay.classList.remove("hidden");
}

function continueToNextRound() {
  round++;
  startRound();
}

function updateDirectionFromKeys() {
  const keys = Array.from(pressedKeys);
  const lastKey = keys[keys.length - 1];
  if (!lastKey) {
    direction = { x: 0, y: 0 };
    return;
  }
  if (lastKey === "arrowup" || lastKey === "w") direction = { x: 0, y: -1 };
  else if (lastKey === "arrowdown" || lastKey === "s") direction = { x: 0, y: 1 };
  else if (lastKey === "arrowleft" || lastKey === "a") direction = { x: -1, y: 0 };
  else if (lastKey === "arrowright" || lastKey === "d") direction = { x: 1, y: 0 };
}

function recordPathPoint(x, y) {
  const last = pathPoints[pathPoints.length - 1];
  if (!last || Math.hypot(x - last.x, y - last.y) > 2) pathPoints.push({ x, y });
  const neededLength = Math.max(120, snake.length * 40);
  if (pathPoints.length > neededLength) {
    pathPoints.splice(0, pathPoints.length - neededLength);
  }
}

function updateBodyPositions() {
  let distanceBack = 0;
  for (let i = 1; i < snake.length; i++) {
    const part = snake[i];
    distanceBack += part.spacing || bodySpacing;
    const target = getPointAlongPathFromEnd(distanceBack);
    if (target) {
      const targetX = target.x + (part.offsetX || 0);
      const targetY = target.y + (part.offsetY || 0);
      part.x += (targetX - part.x) * 0.42;
      part.y += (targetY - part.y) * 0.42;
    }
  }
}

function getPointAlongPathFromEnd(distanceBack) {
  if (pathPoints.length === 0) return null;
  let distance = 0;

  for (let i = pathPoints.length - 1; i > 0; i--) {
    const current = pathPoints[i];
    const previous = pathPoints[i - 1];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);

    if (distance + segment >= distanceBack) {
      const remain = distanceBack - distance;
      const t = segment === 0 ? 0 : remain / segment;
      return {
        x: current.x + (previous.x - current.x) * t,
        y: current.y + (previous.y - current.y) * t,
      };
    }

    distance += segment;
  }

  return pathPoints[0];
}

function checkTrashCollection() {
  const head = snake[0];
  for (let i = trashItems.length - 1; i >= 0; i--) {
    const item = trashItems[i];
    const distance = Math.hypot(head.x - item.x, head.y - item.y);
    const collectDistance = headSize * 0.38 + item.size * 0.38;

    if (distance < collectDistance) {
      score++;
      scoreEl.textContent = score;
      const tail = snake[snake.length - 1];
      const cluster = getCollectedClusterProps();
      snake.push({
        x: tail.x,
        y: tail.y,
        img: item.img,
        size: getCollectedBodySize(item),
        spacing: cluster.spacing,
        offsetX: cluster.offsetX,
        offsetY: cluster.offsetY,
        wobbleSeed: Math.random() * Math.PI * 2,
        wobbleAmount: 0.18 + Math.random() * 0.26,
      });
      trashItems.splice(i, 1);
      updateTrashLeft();
      messageEl.textContent = `Collected ${articleFor(item.category)} ${item.category} ${item.label}.`;
    }
  }
}

function getCollectedBodySize(item) {
  const ranges = item.category === "large"
    ? [0.22, 0.92]
    : item.category === "medium"
    ? [0.26, 1.02]
    : [0.32, 1.12];
  let scale = ranges[0] + Math.random() * (ranges[1] - ranges[0]);
  if (Math.random() < 0.18) scale *= 0.68;
  if (Math.random() < 0.16) scale *= 1.22;
  return Math.max(30, Math.min(190, item.size * scale));
}

function getCollectedClusterProps() {
  const clusterChance = 0.48;
  const isClustered = Math.random() < clusterChance;
  const angle = Math.random() * Math.PI * 2;
  const radius = isClustered ? 8 + Math.random() * 18 : Math.random() * 8;
  const spacing = isClustered
    ? bodySpacing * (0.12 + Math.random() * 0.34)
    : bodySpacing * (0.64 + Math.random() * 0.56);
  return {
    spacing,
    offsetX: Math.cos(angle) * radius,
    offsetY: Math.sin(angle) * radius,
  };
}

function articleFor(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function draw() {
  animationTime += 0.018;
  drawFullOcean();
  if (gameStarted) {
    drawAllTrash();
    drawSnake();
    if (cleanupComplete && showingInfo) drawSoftCompletedBackdrop();
  }
}

function mixColor(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function colorToCss(c, alpha = 1) {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

function drawFullOcean() {
  const cleanRatio = Math.min(score / Math.max(1, getTrashCountForRound()), 1);
  const pulse = (Math.sin(animationTime * 1.4) + 1) * 0.5;
  const dynamicRatio = Math.min(1, cleanRatio * 0.92 + pulse * 0.08);

  const dirtyTop = { r: 104, g: 120, b: 110 };
  const dirtyMid = { r: 82, g: 98, b: 91 };
  const dirtyLow = { r: 56, g: 72, b: 76 };
  const dirtyBottom = { r: 30, g: 46, b: 56 };

  const cleanTop = { r: 141, g: 234, b: 255 };
  const cleanMid = { r: 58, g: 196, b: 230 };
  const cleanLow = { r: 10, g: 122, b: 178 };
  const cleanBottom = { r: 1, g: 60, b: 98 };

  const topColor = mixColor(dirtyTop, cleanTop, dynamicRatio);
  const midColor = mixColor(dirtyMid, cleanMid, dynamicRatio);
  const lowColor = mixColor(dirtyLow, cleanLow, dynamicRatio);
  const bottomColor = mixColor(dirtyBottom, cleanBottom, dynamicRatio);

  const gradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
  gradient.addColorStop(0, colorToCss(topColor));
  gradient.addColorStop(0.24, colorToCss(midColor));
  gradient.addColorStop(0.58, colorToCss(lowColor));
  gradient.addColorStop(1, colorToCss(bottomColor));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  // Murky tint fades away as trash is collected.
  const murk = Math.max(0, 1 - cleanRatio);
  ctx.fillStyle = `rgba(104, 116, 96, ${0.18 * murk})`;
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  // Clean glow increases over time.
  ctx.fillStyle = `rgba(210, 250, 255, ${0.05 + cleanRatio * 0.18})`;
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  const light = ctx.createRadialGradient(
    gameWidth * 0.18,
    gameHeight * 0.08,
    20,
    gameWidth * 0.18,
    gameHeight * 0.08,
    gameWidth * 0.55
  );
  light.addColorStop(0, `rgba(255, 255, 255, ${0.2 + cleanRatio * 0.28})`);
  light.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, gameWidth, gameHeight);

  // Water lines become clearer and brighter as the ocean is cleaned.
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + cleanRatio * 0.16})`;
  ctx.lineWidth = 2.5;
  for (let y = 68; y < gameHeight; y += 96) {
    ctx.beginPath();
    for (let x = -30; x <= gameWidth + 30; x += 22) {
      const waveY = y + Math.sin(x * 0.025 + animationTime * 5 + y * 0.01) * (6 + cleanRatio * 4);
      if (x === -30) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  // Suspended particles reduce as cleanRatio rises.
  const siltCount = Math.floor((gameWidth * gameHeight / 26000) * (0.95 - cleanRatio * 0.65));
  ctx.fillStyle = `rgba(199, 214, 193, ${0.07 + murk * 0.1})`;
  for (let i = 0; i < siltCount; i++) {
    const x = (i * 97 + score * 19) % gameWidth;
    const y = (i * 151 + animationTime * 28 + i * 11) % gameHeight;
    const r = 1 + (i % 4) * 0.75;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bubbles become more visible in the cleaner water.
  ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + cleanRatio * 0.18})`;
  const bubbleCount = Math.floor(gameWidth * gameHeight / 30000);
  for (let i = 0; i < bubbleCount; i++) {
    const x = (i * 137 + score * 11) % gameWidth;
    const y = (i * 227 - animationTime * 60 + gameHeight * 2) % gameHeight;
    const r = 2 + (i % 6);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(
    gameWidth / 2,
    gameHeight / 2,
    Math.min(gameWidth, gameHeight) * 0.15,
    gameWidth / 2,
    gameHeight / 2,
    Math.max(gameWidth, gameHeight) * 0.75
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,20,35,.24)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, gameWidth, gameHeight);
}

function drawAllTrash() {
  trashItems.forEach((item) => {
    const bob = Math.sin(animationTime * 3 + item.bobOffset) * 5;
    drawFloatingImage(item.img, item.x, item.y + bob, item.size, item.rotation + Math.sin(animationTime + item.bobOffset) * 0.08);
  });
}

function drawSnake() {
  const isIdle = direction.x === 0 && direction.y === 0;
  const idleAlpha = isIdle ? 0.68 + Math.sin(animationTime * 8) * 0.25 : 1;

  for (let i = snake.length - 1; i >= 1; i--) {
    const part = snake[i];
    const size = part.size || bodySize;
    const partRotation = Math.sin(part.x * 0.02 + part.y * 0.03 + (part.wobbleSeed || 0)) * (part.wobbleAmount || 0.25);
    ctx.globalAlpha = idleAlpha;
    drawFloatingImage(part.img, part.x, part.y, size, partRotation);
    ctx.globalAlpha = 1;
  }

  ctx.globalAlpha = idleAlpha;
  drawHead(snake[0].x, snake[0].y, isIdle);
  ctx.globalAlpha = 1;

  if (isIdle && gameStarted && !cleanupComplete) drawIdleGlow(snake[0].x, snake[0].y);
}

function drawHead(x, y, isIdle) {
  const pulse = isIdle ? 1 + Math.sin(animationTime * 8) * 0.04 : 1;
  const radius = (headSize / 2) * pulse;
  ctx.fillStyle = "#ffe96b";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#06445d";
  const eyeOffsetX = direction.x * 6;
  const eyeOffsetY = direction.y * 6;
  ctx.beginPath();
  ctx.arc(x - 16 + eyeOffsetX, y - 16 + eyeOffsetY, 6.2, 0, Math.PI * 2);
  ctx.arc(x + 16 + eyeOffsetX, y - 16 + eyeOffsetY, 6.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#06445d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y + 7, 18, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
}

function drawIdleGlow(x, y) {
  ctx.save();
  ctx.globalAlpha = 0.22 + Math.sin(animationTime * 8) * 0.12;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, headSize * 0.66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSoftCompletedBackdrop() {
  ctx.fillStyle = "rgba(0,20,38,.18)";
  ctx.fillRect(0, 0, gameWidth, gameHeight);
}

function drawFloatingImage(img, x, y, size, rotation) {
  if (!img) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawIdleScreenText() {
  ctx.fillStyle = "rgba(0,30,55,.25)";
  ctx.fillRect(0, 0, gameWidth, gameHeight);
  ctx.fillStyle = "rgba(255,255,255,.76)";
  ctx.textAlign = "center";
  ctx.font = '560 42px "Instrument Sans", Arial, sans-serif';
  ctx.fillText("Ocean Waste Collector", gameWidth / 2, gameHeight / 2 - 30);
  ctx.font = '400 18px "Instrument Sans", Arial, sans-serif';
  ctx.fillText("Hold a direction key to move. Release to idle.", gameWidth / 2, gameHeight / 2 + 18);
  ctx.textAlign = "left";
}

function normalizeKey(key) {
  const k = key.toLowerCase();
  return ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k) ? k : null;
}

document.addEventListener("keydown", (event) => {
  if (showingInfo) return;
  const key = normalizeKey(event.key);
  if (!key) return;
  event.preventDefault();
  if (pressedKeys.has(key)) pressedKeys.delete(key);
  pressedKeys.add(key);
});

document.addEventListener("keyup", (event) => {
  const key = normalizeKey(event.key);
  if (!key) return;
  event.preventDefault();
  pressedKeys.delete(key);
});

window.addEventListener("blur", () => {
  pressedKeys.clear();
  direction = { x: 0, y: 0 };
});

startButton.addEventListener("click", () => {
  startButton.blur();
  startFreshGame();
});

continueButton.addEventListener("click", () => {
  continueButton.blur();
  continueToNextRound();
});
