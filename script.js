
/* ==========================================
   NEON PULSE V0.5
   COMPLETE GAME ENGINE
   ========================================== */

"use strict";

/* ---------- DOM ELEMENTS ---------- */

const $ = (id) => document.getElementById(id);

const canvas = $("game-canvas");
const ctx = canvas.getContext("2d");

const screens = document.querySelectorAll(".screen");

const scoreText = $("score");
const comboText = $("combo");
const gemCountText = $("gem-count");
const bestText = $("game-best");

const menuBest = $("menu-best");
const menuGems = $("menu-gems");

const shopGems = $("shop-gems");
const skinsGems = $("skins-gems");

const shieldStatus = $("shield-status");
const magnetStatus = $("magnet-status");
const speedStatus = $("speed-status");

const shieldTimerText = $("shield-timer");
const magnetTimerText = $("magnet-timer");
const speedTimerText = $("speed-timer");

const finalScoreText = $("final-score");
const recordMessage = $("record-message");

/* ---------- SAVE DATA ---------- */

const SAVE_KEY = "neonPulseV05Save";

const defaultSave = {
  gems: 0,
  best: 0,
  totalGames: 0,
  totalGems: 0,
  totalPowerups: 0,

  upgrades: {
    shield: 1,
    magnet: 1,
    speed: 1
  },

  unlockedSkins: ["cyan"],
  selectedSkin: "cyan",

  lastRewardDate: "",

  settings: {
    sound: true,
    shake: true,
    vibration: true
  },

  missionProgress: {
    score: 0,
    gems: 0,
    games: 0,
    powerups: 0
  },

  missionClaimed: []
};

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));

    if (!saved || typeof saved !== "object") {
      return structuredClone(defaultSave);
    }

    return {
      ...structuredClone(defaultSave),
      ...saved,

      upgrades: {
        ...defaultSave.upgrades,
        ...(saved.upgrades || {})
      },

      settings: {
        ...defaultSave.settings,
        ...(saved.settings || {})
      },

      missionProgress: {
        ...defaultSave.missionProgress,
        ...(saved.missionProgress || {})
      },

      unlockedSkins: Array.isArray(saved.unlockedSkins)
        ? saved.unlockedSkins
        : ["cyan"],

      missionClaimed: Array.isArray(saved.missionClaimed)
        ? saved.missionClaimed
        : []
    };
  } catch (error) {
    console.warn("Save data could not be loaded:", error);
    return structuredClone(defaultSave);
  }
}

let saveData = loadSave();

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (error) {
    console.warn("Save failed:", error);
  }
}

/* ---------- GAME SETTINGS ---------- */

let soundEnabled = saveData.settings.sound;
let shakeEnabled = saveData.settings.shake;
let vibrationEnabled = saveData.settings.vibration;

let running = false;
let paused = false;
let gameOver = false;

let animationId = null;
let lastFrameTime = 0;

let score = 0;
let combo = 1;
let runGems = 0;

let obstacleTimer = 0;
let gemTimer = 0;
let powerupTimer = 0;

let shakeTime = 0;
let shakePower = 0;

let playerLane = 0;

let obstacles = [];
let gems = [];
let powerups = [];
let particles = [];

/* ---------- POWER-UP STATE ---------- */

const powerState = {
  shield: 0,
  magnet: 0,
  speed: 0
};

/* ---------- SKINS ---------- */

const skins = [
  {
    id: "cyan",
    name: "CYBER CYAN",
    color: "#22d3ee",
    price: 0
  },
  {
    id: "pink",
    name: "NEON PINK",
    color: "#ff36b7",
    price: 150
  },
  {
    id: "gold",
    name: "GOLDEN PULSE",
    color: "#ffe45c",
    price: 300
  },
  {
    id: "purple",
    name: "PURPLE STORM",
    color: "#b66bff",
    price: 450
  },
  {
    id: "green",
    name: "TOXIC GREEN",
    color: "#63ff9b",
    price: 600
  }
];

function currentSkin() {
  return skins.find(s => s.id === saveData.selectedSkin) || skins[0];
}

/* ---------- MISSIONS ---------- */

const missions = [
  {
    id: "score",
    title: "SCORE HUNTER",
    description: "Reach a score of 100",
    target: 100,
    reward: 30
  },
  {
    id: "gems",
    title: "GEM COLLECTOR",
    description: "Collect 10 gems",
    target: 10,
    reward: 40
  },
  {
    id: "games",
    title: "ARCADE REGULAR",
    description: "Play 5 games",
    target: 5,
    reward: 50
  },
  {
    id: "powerups",
    title: "POWER MASTER",
    description: "Collect 5 power-ups",
    target: 5,
    reward: 60
  }
];

/* ---------- AUDIO ---------- */

let audioContext = null;

function playSound(frequency = 500, duration = 0.08, type = "sine") {
  if (!soundEnabled) return;

  try {
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("Audio unavailable:", error);
  }
}

function vibrate(pattern = 30) {
  if (!vibrationEnabled) return;

  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

/* ---------- SCREEN MANAGEMENT ---------- */

function showScreen(screenId) {
  screens.forEach(screen => {
    screen.classList.remove("active");
  });

  const target = $(screenId);

  if (target) {
    target.classList.add("active");
  }

  if (screenId === "main-menu") {
    updateMenu();
  }

  if (screenId === "shop-screen") {
    updateShop();
  }

  if (screenId === "skins-screen") {
    renderSkins();
  }

  if (screenId === "missions-screen") {
    renderMissions();
  }

  if (screenId === "rewards-screen") {
    updateDailyReward();
  }
}

/* ---------- CANVAS SIZE ---------- */

let width = 0;
let height = 0;
let pixelRatio = 1;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();

  width = rect.width;
  height = rect.height;

  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);

  ctx.setTransform(
    pixelRatio,
    0,
    0,
    pixelRatio,
    0,
    0
  );
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 200);
});

resizeCanvas();

/* ---------- GAME GEOMETRY ---------- */

function laneX(lane) {
  return width * (lane === 0 ? 0.35 : 0.65);
}

function playerY() {
  return height * 0.78;
}

/* ---------- HUD ---------- */

function updateHUD() {
  scoreText.textContent = Math.floor(score);
  comboText.textContent = "x" + combo;
  gemCountText.textContent = runGems;
  bestText.textContent = saveData.best;

  updatePowerupHUD();
}

function updateMenu() {
  menuBest.textContent = saveData.best;
  menuGems.textContent = saveData.gems + " 💎";
}

function updatePowerupHUD() {
  const items = [
    ["shield", shieldStatus, shieldTimerText],
    ["magnet", magnetStatus, magnetTimerText],
    ["speed", speedStatus, speedTimerText]
  ];

  items.forEach(([name, element, timer]) => {
    const remaining = powerState[name];

    element.classList.toggle("active", remaining > 0);

    timer.textContent = remaining > 0
      ? Math.ceil(remaining) + "s"
      : "0s";
  });
}

/* ---------- GAME START ---------- */

function startGame() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  score = 0;
  combo = 1;
  runGems = 0;

  obstacleTimer = 0;
  gemTimer = 0;
  powerupTimer = 0;

  playerLane = 0;

  obstacles = [];
  gems = [];
  powerups = [];
  particles = [];

  shakeTime = 0;
  shakePower = 0;

  powerState.shield = 0;
  powerState.magnet = 0;
  powerState.speed = 0;

  running = true;
  paused = false;
  gameOver = false;

  saveData.totalGames++;
  saveData.missionProgress.games = saveData.totalGames;
  saveGame();

  showScreen("game-screen");

  requestAnimationFrame(() => {
    resizeCanvas();
    updateHUD();

    lastFrameTime = performance.now();

    playSound(600, 0.12);

    animationId = requestAnimationFrame(gameLoop);
  });
}

/* ---------- PLAYER CONTROL ---------- */


function switchLane() {
  if (!running || paused || gameOver) return;

  playerLane = playerLane === 0 ? 1 : 0;

  playSound(420, 0.05);
}


canvas.addEventListener("pointerdown", (event) => {
  if (!running || paused) return;

  event.preventDefault();
  switchLane();
});

/* ---------- SPAWNING ---------- */


function spawnObstacle() {
  const lastObstacle = obstacles[obstacles.length - 1];

  let lane = Math.random() < 0.5 ? 0 : 1;

  // Avoid too many consecutive obstacles
  if (lastObstacle && Math.random() < 0.65) {
    lane = lastObstacle.lane === 0 ? 1 : 0;
  }

  obstacles.push({
    lane: lane,
    y: -40,
    size: 17,
    destroyed: false,
    passed: false,
    type: Math.random() < 0.2 ? "special" : "normal"
  });
}


function spawnGem() {
  gems.push({
    lane: Math.random() < 0.5 ? 0 : 1,
    x: 0,
    y: -25,
    radius: 9,
    collected: false
  });
}

function spawnPowerup() {
  if (powerups.length > 0) return;

  const types = ["shield", "magnet", "speed"];
  const type = types[Math.floor(Math.random() * types.length)];

  powerups.push({
    type,
    lane: Math.random() < 0.5 ? 0 : 1,
    y: -35,
    radius: 15
  });
}

/* ---------- PARTICLES ---------- */

function createParticles(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: 2 + Math.random() * 3
    });
  }
}

function updateParticles(delta) {
  particles.forEach(p => {
    p.x += p.vx * delta * 60;
    p.y += p.vy * delta * 60;
    p.life -= delta * 1.8;
  });

  particles = particles.filter(p => p.life > 0);
}

/* ---------- POWER-UP ACTIVATION ---------- */

function activatePowerup(type) {
  const level = saveData.upgrades[type] || 1;

  const durations = {
    shield: 8,
    magnet: 7,
    speed: 5
  };

  const extraTime = (level - 1) * 2;

  powerState[type] = durations[type] + extraTime;

  saveData.totalPowerups++;
  saveData.missionProgress.powerups = saveData.totalPowerups;

  saveGame();

  const colors = {
    shield: "#22d3ee",
    magnet: "#ffe45c",
    speed: "#ff36b7"
  };

  createParticles(
    laneX(playerLane),
    playerY(),
    colors[type],
    20
  );

  playSound(850, 0.16, "triangle");
  vibrate(40);

  updatePowerupHUD();
}

/* ---------- GEM COLLECTION ---------- */

function collectGem(gem) {
  if (gem.collected) return;

  gem.collected = true;

  const multiplier = powerState.speed > 0 ? 2 : 1;
  const reward = 25 * multiplier;

  score += reward;
  runGems++;

  saveData.gems++;
  saveData.totalGems++;

  saveData.missionProgress.gems = saveData.totalGems;

  createParticles(
    gem.x,
    gem.y,
    "#ffe45c",
    12
  );

  playSound(950, 0.07, "sine");

  saveGame();
  updateHUD();
}

/* ---------- OBSTACLE COLLISION ---------- */


function checkObstacleCollision(obstacle) {
  if (obstacle.destroyed) return false;

  const sameLane = obstacle.lane === playerLane;

  const closeEnough =
    Math.abs(obstacle.y - playerY()) < 27;

  if (!sameLane || !closeEnough) return false;

  const x = laneX(playerLane);
  const y = playerY();

  if (powerState.shield > 0) {
    powerState.shield = 0;
    obstacle.destroyed = true;

    createParticles(x, y, "#22d3ee", 35);

    playSound(300, 0.15, "triangle");
    vibrate(40);

    updatePowerupHUD();
    return false;
  }

  // NEON COLLISION EXPLOSION
  createParticles(x, y, "#ff36b7", 45);
  createParticles(x, y, "#22d3ee", 25);

  shakeTime = 0.35;

  playSound(120, 0.3, "sawtooth");
  vibrate(100);

  return true;
}


/* ---------- PAUSE SYSTEM ---------- */

function pauseGame() {
  if (!running || paused) return;

  paused = true;

  showScreen("pause-screen");

  playSound(300, 0.08);
}

function resumeGame() {
  if (!running || !paused) return;

  paused = false;

  showScreen("game-screen");

  lastFrameTime = performance.now();

  animationId = requestAnimationFrame(gameLoop);
}

function returnToMenu() {
  running = false;
  paused = false;
  gameOver = false;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  showScreen("main-menu");
}

/* ---------- GAME OVER ---------- */

function endGame() {
  if (gameOver) return;

  running = false;
  gameOver = true;
  paused = false;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  const finalScore = Math.floor(score);

  const newRecord = finalScore > saveData.best;

  if (newRecord) {
    saveData.best = finalScore;
  }

  saveData.missionProgress.score = Math.max(
    saveData.missionProgress.score,
    finalScore
  );

  saveGame();

  finalScoreText.textContent = finalScore;

  recordMessage.textContent = newRecord
    ? "🏆 NEW PERSONAL RECORD!"
    : "Keep pushing your limits!";

  playSound(150, 0.35, "sawtooth");
  vibrate([80, 50, 100]);

  showScreen("game-over");
}

/* ---------- GAME UPDATE ---------- */

function updateGame(delta) {
  const speed = 250 + Math.min(score * 0.7, 220);

  // POWER-UP TIMERS

  Object.keys(powerState).forEach(type => {
    if (powerState[type] > 0) {
      powerState[type] = Math.max(
        0,
        powerState[type] - delta
      );
    }
  });

  updatePowerupHUD();

  // SPAWN TIMERS

  obstacleTimer += delta;
  gemTimer += delta;
  powerupTimer += delta;

  const obstacleInterval = Math.max(
    0.48,
    1.05 - score * 0.0015
  );

  if (obstacleTimer >= obstacleInterval) {
    obstacleTimer = 0;
    spawnObstacle();
  }

  if (gemTimer >= 1.15) {
    gemTimer = 0;
    spawnGem();
  }

  if (powerupTimer >= 11) {
    powerupTimer = 0;
    spawnPowerup();
  }

  // OBSTACLES

  obstacles.forEach(obstacle => {
    obstacle.y += speed * delta;

    if (checkObstacleCollision(obstacle)) {
      endGame();
      return;
    }

    if (
      !obstacle.passed &&
      obstacle.y > playerY() + 25
    ) {
      obstacle.passed = true;

      score += 10 * (powerState.speed > 0 ? 2 : 1);

      combo = Math.min(combo + 1, 20);

      playSound(600, 0.04);

      saveData.missionProgress.score = Math.max(
        saveData.missionProgress.score,
        Math.floor(score)
      );

      updateHUD();
    }
  });

  if (gameOver) return;

  obstacles = obstacles.filter(
    o => o.y < height + 60 && !o.destroyed
  );

  // GEMS

  gems.forEach(gem => {
    gem.x = laneX(gem.lane);
    gem.y += speed * delta;

    if (powerState.magnet > 0) {
      const targetX = laneX(playerLane);
      const targetY = playerY();

      const dx = targetX - gem.x;
      const dy = targetY - gem.y;

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 190) {
        gem.x += dx * Math.min(1, delta * 5);
        gem.y += dy * Math.min(1, delta * 5);
      }
    }

    const dx = laneX(playerLane) - gem.x;
    const dy = playerY() - gem.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 25) {
      collectGem(gem);
    }
  });

  gems = gems.filter(
    g => !g.collected && g.y < height + 30
  );

  // POWER-UP OBJECTS

  powerups.forEach(powerup => {
    powerup.y += speed * delta * 0.85;

    if (
      powerup.lane === playerLane &&
      Math.abs(powerup.y - playerY()) < 28
    ) {
      activatePowerup(powerup.type);
      powerup.collected = true;
    }
  });

  powerups = powerups.filter(
    p => !p.collected && p.y < height + 40
  );

  // PARTICLES

  updateParticles(delta);

  // SCORE

  score += delta * 2;

  if (shakeTime > 0) {
    shakeTime = Math.max(0, shakeTime - delta);
  }

  updateHUD();
}

/* ---------- BACKGROUND DRAWING ---------- */

function drawBackground() {
  ctx.fillStyle = "#09051b";
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    10,
    width / 2,
    height / 2,
    height
  );

  gradient.addColorStop(0, "rgba(55,20,100,0.25)");
  gradient.addColorStop(1, "rgba(9,5,27,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // LANES

  ctx.save();

  ctx.strokeStyle = "rgba(34,211,238,0.18)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 15]);

  ctx.beginPath();
  ctx.moveTo(width * 0.5, 0);
  ctx.lineTo(width * 0.5, height);
  ctx.stroke();

  ctx.restore();

  // LANE GLOW

  [0, 1].forEach(lane => {
    ctx.beginPath();
    ctx.arc(laneX(lane), playerY(), 35, 0, Math.PI * 2);

    ctx.strokeStyle = "rgba(34,211,238,0.07)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/* ---------- PLAYER DRAWING ---------- */


function drawPlayer() {
  const targetX = laneX(playerLane);

  // SMOOTH LEFT-RIGHT MOVEMENT
  if (typeof drawPlayer.currentX !== "number") {
    drawPlayer.currentX = targetX;
  }

  drawPlayer.currentX +=
    (targetX - drawPlayer.currentX) * 0.22;

  const x = drawPlayer.currentX;
  const y = playerY();
  const color = currentSkin().color;

  // NEON TRAIL
  const trail = ctx.createLinearGradient(
    x, y + 10, x, y + 70
  );

  trail.addColorStop(0, color + "88");
  trail.addColorStop(1, color + "00");

  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(x - 11, y + 10);
  ctx.lineTo(x + 11, y + 10);
  ctx.lineTo(x + 24, y + 65);
  ctx.lineTo(x - 24, y + 65);
  ctx.closePath();
  ctx.fill();

  // PLAYER GLOW
  ctx.save();

  ctx.shadowBlur = 28;
  ctx.shadowColor = color;

  const playerGradient = ctx.createRadialGradient(
    x - 5, y - 6, 2,
    x, y, 23
  );

  playerGradient.addColorStop(0, "#ffffff");
  playerGradient.addColorStop(0.35, color);
  playerGradient.addColorStop(1, "#31105e");

  ctx.fillStyle = playerGradient;

  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // SHIELD RING
  if (powerState.shield > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#22d3ee";
    ctx.stroke();
    ctx.restore();
  }

  // MAGNET RING
  if (powerState.magnet > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffe45c";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.restore();
  }

  // SPEED RING
  if (powerState.speed > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff36b7";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff36b7";
    ctx.stroke();
    ctx.restore();
  }
}


/* ---------- OBSTACLE DRAWING ---------- */

function drawObstacles() {
  obstacles.forEach(obstacle => {
    const x = laneX(obstacle.lane);
    const y = obstacle.y;

    ctx.save();

    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff36b7";

    ctx.fillStyle = "#ff36b7";
    ctx.fillRect(
      x - obstacle.size,
      y - obstacle.size,
      obstacle.size * 2,
      obstacle.size * 2
    );

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.strokeRect(
      x - obstacle.size,
      y - obstacle.size,
      obstacle.size * 2,
      obstacle.size * 2
    );

    ctx.restore();
  });
}

/* ---------- GEM DRAWING ---------- */

function drawGems() {
  gems.forEach(gem => {
    ctx.save();

    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ffe45c";

    ctx.fillStyle = "#ffe45c";

    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - 11);
    ctx.lineTo(gem.x + 9, gem.y);
    ctx.lineTo(gem.x, gem.y + 11);
    ctx.lineTo(gem.x - 9, gem.y);
    ctx.closePath();

    ctx.fill();

    ctx.restore();
  });
}

/* ---------- POWER-UP DRAWING ---------- */

function drawPowerups() {
  const symbols = {
    shield: "🛡️",
    magnet: "🧲",
    speed: "⚡"
  };

  const colors = {
    shield: "#22d3ee",
    magnet: "#ffe45c",
    speed: "#ff36b7"
  };

  powerups.forEach(powerup => {
    const x = laneX(powerup.lane);
    const y = powerup.y;

    ctx.save();

    ctx.shadowBlur = 22;
    ctx.shadowColor = colors[powerup.type];

    ctx.fillStyle = "rgba(20,10,40,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors[powerup.type];
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = "19px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(symbols[powerup.type], x, y);

    ctx.restore();
  });
}

/* ---------- PARTICLE DRAWING ---------- */

function drawParticles() {
  particles.forEach(p => {
    ctx.save();

    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

/* ---------- DRAW ALL ---------- */

function drawGame() {
  ctx.save();

  if (shakeEnabled && shakeTime > 0) {
    const amount = shakePower * (shakeTime / 0.3);

    ctx.translate(
      (Math.random() - 0.5) * amount,
      (Math.random() - 0.5) * amount
    );
  }

  drawBackground();
  drawGems();
  drawPowerups();
  drawObstacles();
  drawPlayer();
  drawParticles();

  ctx.restore();
}

/* ---------- GAME LOOP ---------- */

function gameLoop(timestamp) {
  if (!running || paused || gameOver) return;

  const delta = Math.min(
    (timestamp - lastFrameTime) / 1000,
    0.04
  );

  lastFrameTime = timestamp;

  updateGame(delta);
  drawGame();

  if (running && !paused && !gameOver) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

/* ---------- SHOP ---------- */

function updateShop() {
  shopGems.textContent = saveData.gems;

  $("shield-level").textContent =
    "Level " + saveData.upgrades.shield;

  $("magnet-level").textContent =
    "Level " + saveData.upgrades.magnet;

  $("speed-level").textContent =
    "Level " + saveData.upgrades.speed;
}

function buyUpgrade(type) {
  const level = saveData.upgrades[type];

  if (level >= 5) {
    alert("Maximum upgrade level reached!");
    return;
  }

  const price = 100 * level;

  if (saveData.gems < price) {
    alert("Not enough gems! Play more games to collect gems.");
    return;
  }

  saveData.gems -= price;
  saveData.upgrades[type]++;

  saveGame();

  updateShop();
  updateMenu();

  playSound(850, 0.12);

  alert(type.toUpperCase() + " upgraded to Level " +
    saveData.upgrades[type] + "!");
}

document.querySelectorAll("[data-upgrade]").forEach(button => {
  button.addEventListener("click", () => {
    buyUpgrade(button.dataset.upgrade);
  });
});

/* ---------- SKIN SHOP ---------- */

function renderSkins() {
  skinsGems.textContent = saveData.gems;

  const container = $("skins-list");

  container.innerHTML = "";

  skins.forEach(skin => {
    const unlocked = saveData.unlockedSkins.includes(skin.id);
    const selected = saveData.selectedSkin === skin.id;

    const card = document.createElement("div");
    card.className = "skin-card";

    card.innerHTML = `
      <div class="skin-preview"
        style="background:${skin.color};color:${skin.color}">
      </div>

      <div class="skin-details">
        <strong>${skin.name}</strong>
        <small>${selected ? "Currently selected" : unlocked ? "Unlocked" : "Locked"}</small>
      </div>

      <button class="skin-action">
        ${selected ? "SELECTED" : unlocked ? "USE" : skin.price + " 💎"}
      </button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      if (unlocked) {
        saveData.selectedSkin = skin.id;
        saveGame();
        renderSkins();
        playSound(700, 0.08);
        return;
      }

      if (saveData.gems < skin.price) {
        alert("Not enough gems to unlock this skin!");
        return;
      }

      saveData.gems -= skin.price;
      saveData.unlockedSkins.push(skin.id);
      saveData.selectedSkin = skin.id;

      saveGame();

      renderSkins();
      updateMenu();

      playSound(900, 0.15);

      alert("New skin unlocked!");
    });

    container.appendChild(card);
  });
}

/* ---------- ACHIEVEMENTS ---------- */

function renderMissions() {
  const container = $("missions-list");

  container.innerHTML = "";

  missions.forEach(mission => {
    const progress = Math.min(
      saveData.missionProgress[mission.id] || 0,
      mission.target
    );

    const completed = progress >= mission.target;

    const claimed = saveData.missionClaimed.includes(mission.id);

    const percentage = (progress / mission.target) * 100;

    const card = document.createElement("div");
    card.className = "mission-card";

    card.innerHTML = `
      <strong>🏆 ${mission.title}</strong>
      <small>${mission.description}</small>
      <small>${progress} / ${mission.target}</small>

      <div class="mission-progress">
        <span style="width:${percentage}%"></span>
      </div>

      <small>Reward: ${mission.reward} 💎</small>

      <button class="skin-action" style="margin-top:10px">
        ${claimed ? "CLAIMED" : completed ? "CLAIM REWARD" : "IN PROGRESS"}
      </button>
    `;

    const button = card.querySelector("button");

    button.disabled = !completed || claimed;

    if (!completed || claimed) {
      button.style.opacity = "0.45";
    }

    button.addEventListener("click", () => {
      if (!completed || claimed) return;

      saveData.gems += mission.reward;
      saveData.missionClaimed.push(mission.id);

      saveGame();

      renderMissions();
      updateMenu();

      playSound(950, 0.15);
    });

    container.appendChild(card);
  });
}

/* ---------- DAILY REWARD ---------- */

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function updateDailyReward() {
  const claimed = saveData.lastRewardDate === getToday();

  const button = $("claim-reward-button");
  const status = $("reward-status");

  button.disabled = claimed;

  button.textContent = claimed
    ? "ALREADY CLAIMED"
    : "CLAIM REWARD";

  button.style.opacity = claimed ? "0.5" : "1";

  status.textContent = claimed
    ? "Come back tomorrow for your next gift!"
    : "Your 50 gems are ready to collect!";
}

$("claim-reward-button").addEventListener("click", () => {
  if (saveData.lastRewardDate === getToday()) {
    updateDailyReward();
    return;
  }

  saveData.gems += 50;
  saveData.lastRewardDate = getToday();

  saveGame();

  updateDailyReward();
  updateMenu();

  playSound(1000, 0.2);
  vibrate(50);

  alert("🎁 Congratulations! 50 gems added to your wallet.");
});

/* ---------- SETTINGS ---------- */

function updateSettingsUI() {
  $("sound-toggle").checked = soundEnabled;
  $("shake-toggle").checked = shakeEnabled;
  $("vibration-toggle").checked = vibrationEnabled;
}

$("sound-toggle").addEventListener("change", event => {
  soundEnabled = event.target.checked;
  saveData.settings.sound = soundEnabled;
  saveGame();
});

$("shake-toggle").addEventListener("change", event => {
  shakeEnabled = event.target.checked;
  saveData.settings.shake = shakeEnabled;
  saveGame();
});

$("vibration-toggle").addEventListener("change", event => {
  vibrationEnabled = event.target.checked;
  saveData.settings.vibration = vibrationEnabled;
  saveGame();
});

/* ---------- BUTTON EVENTS ---------- */

$("start-button").addEventListener("click", startGame);

$("pause-button").addEventListener("click", pauseGame);

$("resume-button").addEventListener("click", resumeGame);

$("retry-button").addEventListener("click", startGame);

$("home-button").addEventListener("click", returnToMenu);

$("pause-home-button").addEventListener("click", returnToMenu);

$("shop-button").addEventListener("click", () => {
  showScreen("shop-screen");
});

$("skins-button").addEventListener("click", () => {
  showScreen("skins-screen");
});

$("missions-button").addEventListener("click", () => {
  showScreen("missions-screen");
});

$("rewards-button").addEventListener("click", () => {
  showScreen("rewards-screen");
});

$("settings-button").addEventListener("click", () => {
  updateSettingsUI();
  showScreen("settings-screen");
});

$("how-button").addEventListener("click", () => {
  showScreen("how-screen");
});

document.querySelectorAll("[data-back]").forEach(button => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.back);
  });
});

/* ---------- INITIALIZATION ---------- */

function initializeGame() {
  resizeCanvas();

  updateMenu();
  updateShop();
  updateSettingsUI();
  updateHUD();

  showScreen("main-menu");

  console.log("NEON PULSE V0.5 READY!");
}

initializeGame();
