'use strict';

/* ============================================================
   Лабораторная работа №6 — Змейка на Canvas (с настройками).

   Что настраивается:
   • размер поля  — 10×10 .. 30×30 клеток,
   • число яблок  — сколько их одновременно на поле.

   Логический размер канваса всегда 400×400 «CSS-пикселей»,
   поэтому размер клетки пересчитывается как LOGICAL_SIZE / cols.
   Настройки применяются в момент старта партии и блокируются,
   пока партия идёт.
   ============================================================ */

/* ---------- 1. КОНСТАНТЫ ---------- */

const LOGICAL_SIZE = 400;        // логический размер поля (CSS-пиксели)

const BASE_INTERVAL = 150;       // мс на клетку в начале партии
const MIN_INTERVAL  = 70;        // предел ускорения
const SPEED_STEP    = 5;         // ускорение за каждое яблоко (мс)

const COLORS = {
  bg:         '#0b0d13',
  grid:       '#141824',
  head:       '#7bed9f',
  bodyFrom:   '#2ecc71',
  bodyTo:     '#1abc9c',
  apple:      '#e74c3c',
  appleLeaf:  '#2ecc71',
  overlay:    'rgba(11, 13, 19, 0.82)',
  overlayTxt: '#eef1f8',
  overlaySub: '#8b93a7',
};

const KEY_DIRECTIONS = {
  ArrowUp:    { x: 0,  y: -1 },
  ArrowDown:  { x: 0,  y: 1  },
  ArrowLeft:  { x: -1, y: 0  },
  ArrowRight: { x: 1,  y: 0  },
};

/* ---------- 2. СОСТОЯНИЕ ---------- */

const state = {
  // геометрия поля — перезаписывается в startGame() по настройкам
  cols:      20,
  rows:      20,
  cellSize:  LOGICAL_SIZE / 20,

  // игровые данные
  snake:         [],
  apples:        [],   // массив яблок [{x, y}, ...]
  appleCount:    1,    // сколько яблок должно быть на поле
  direction:     { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },

  score:      0,
  best:       0,
  gameOver:   false,
  won:        false,
  running:    false,

  moveInterval: BASE_INTERVAL,
  accumulator:  0,
};

/* ---------- 3. DOM ---------- */

const canvas     = document.getElementById('canvas');
const ctx        = canvas.getContext('2d');
const scoreEl    = document.getElementById('score');
const bestEl     = document.getElementById('best');
const fieldEl    = document.getElementById('field');
const speedEl    = document.getElementById('speed');
const restartBtn = document.getElementById('restart');
const sizeSelect   = document.getElementById('size-select');
const applesSelect = document.getElementById('apples-select');

/* Чёткость на HiDPI. Логический размер канваса не меняется,
   меняется только его физическое разрешение. */
(function setupHiDPI() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = LOGICAL_SIZE * dpr;
  canvas.height = LOGICAL_SIZE * dpr;
  canvas.style.width  = LOGICAL_SIZE + 'px';
  canvas.style.height = LOGICAL_SIZE + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
})();

/* ---------- 4. СТАРТ ПАРТИИ ---------- */

function startGame() {
  // 4.1. Прочитать настройки
  state.cols       = Number(sizeSelect.value);
  state.rows       = state.cols;
  state.cellSize   = LOGICAL_SIZE / state.cols;
  state.appleCount = Number(applesSelect.value);

  // 4.2. Змейка по центру поля, длиной 3, движется вправо
  const cx = Math.floor(state.cols / 2);
  const cy = Math.floor(state.rows / 2);

  state.snake = [
    { x: cx,     y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  state.direction     = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };

  // 4.3. Сброс прогресса
  state.apples       = [];
  state.score        = 0;
  state.gameOver     = false;
  state.won          = false;
  state.running      = true;
  state.moveInterval = BASE_INTERVAL;
  state.accumulator  = 0;

  // 4.4. Наполняем поле яблоками
  spawnApples();

  // 4.5. UI
  restartBtn.textContent = 'Начать заново';
  syncHud();
  updateSettingsEnabled();

  // Сброс «эталонного» времени кадра
  prevTimestamp = 0;
}

/* ---------- 5. ЛОГИКА ---------- */

/**
 * Досоздаёт яблоки так, чтобы на поле оказалось ровно appleCount штук.
 * Уже лежащие яблоки не трогает — это позволяет вызывать функцию
 * при съедании одного яблока и получать «одно новое» в замену.
 *
 * Если свободного места не хватает — выигрыш (все клетки заняты).
 */
function spawnApples() {
  let needed = state.appleCount - state.apples.length;
  if (needed <= 0) return;

  // Собираем свободные клетки
  const free = [];
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const onSnake = state.snake.some(s => s.x === x && s.y === y);
      const onApple = state.apples.some(a => a.x === x && a.y === y);
      if (!onSnake && !onApple) free.push({ x, y });
    }
  }

  // Свободных клеток нет совсем — победа
  if (free.length === 0 && state.apples.length === 0) {
    state.gameOver = true;
    state.won = true;
    return;
  }

  // Случайно раскидываем нужное количество яблок по свободным клеткам
  while (needed > 0 && free.length > 0) {
    const idx = Math.floor(Math.random() * free.length);
    state.apples.push(free[idx]);
    free.splice(idx, 1);
    needed--;
  }
}

/**
 * Проверяет, столкнётся ли голова с препятствием.
 * @param {{x:number,y:number}} head
 * @param {boolean} willGrow — если true, хвост останется на месте
 */
function checkCollision(head, willGrow) {
  if (head.x < 0 || head.x >= state.cols) return true;
  if (head.y < 0 || head.y >= state.rows) return true;

  const limit = willGrow ? state.snake.length : state.snake.length - 1;
  for (let i = 0; i < limit; i++) {
    if (state.snake[i].x === head.x && state.snake[i].y === head.y) return true;
  }
  return false;
}

/**
 * Один шаг змейки на одну клетку.
 */
function moveSnake() {
  state.direction = state.nextDirection;

  const head = state.snake[0];
  const next = { x: head.x + state.direction.x, y: head.y + state.direction.y };

  const willEat = state.apples.some(a => a.x === next.x && a.y === next.y);

  if (checkCollision(next, willEat)) {
    endGame();
    return;
  }

  state.snake.unshift(next);

  if (willEat) {
    // Убираем съеденное яблоко и добираем до нужного количества
    state.apples = state.apples.filter(a => !(a.x === next.x && a.y === next.y));
    spawnApples();

    state.score++;
    state.best = Math.max(state.best, state.score);

    state.moveInterval = Math.max(
      MIN_INTERVAL,
      BASE_INTERVAL - state.score * SPEED_STEP
    );

    syncHud();
  } else {
    state.snake.pop();
  }
}

function endGame() {
  state.gameOver = true;
  state.running  = false;
  state.best = Math.max(state.best, state.score);
  syncHud();
  updateSettingsEnabled();
}

/**
 * Обновление состояния по deltaTime. Без рисования.
 */
function update(dt) {
  if (!state.running || state.gameOver) return;

  state.accumulator += dt;

  while (state.accumulator >= state.moveInterval) {
    state.accumulator -= state.moveInterval;
    moveSnake();
    if (state.gameOver) break;
  }
}

/* ---------- 6. ОТРИСОВКА ---------- */

function draw() {
  drawBackground();
  drawGrid();
  drawApples();
  drawSnake();
  if (state.gameOver) drawGameOverOverlay();
}

function drawBackground() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
}

function drawGrid() {
  const step = state.cellSize;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = 0; x <= state.cols; x++) {
    ctx.moveTo(x * step + 0.5, 0);
    ctx.lineTo(x * step + 0.5, LOGICAL_SIZE);
  }
  for (let y = 0; y <= state.rows; y++) {
    ctx.moveTo(0, y * step + 0.5);
    ctx.lineTo(LOGICAL_SIZE, y * step + 0.5);
  }
  ctx.stroke();
}

function drawApples() {
  for (const apple of state.apples) drawApple(apple);
}

function drawApple(apple) {
  const c = state.cellSize;
  const cx = apple.x * c + c / 2;
  const cy = apple.y * c + c / 2;
  const r  = c * 0.36;

  ctx.save();

  // мягкое свечение
  ctx.shadowColor = 'rgba(231, 76, 60, .55)';
  ctx.shadowBlur  = Math.max(6, c * 0.5);

  // плод
  ctx.fillStyle = COLORS.apple;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // блик
  ctx.fillStyle = 'rgba(255, 255, 255, .35)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // листик (только если клетка достаточно большая)
  if (r > 4) {
    ctx.fillStyle = COLORS.appleLeaf;
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.35, cy - r * 0.9, r * 0.42, r * 0.2, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnake() {
  const c = state.cellSize;
  const total = state.snake.length;

  // внутренние отступы и радиусы адаптируются под размер клетки
  const pad    = Math.max(1, c * 0.075);
  const radius = Math.min(6, c * 0.25);

  state.snake.forEach((seg, i) => {
    const px = seg.x * c;
    const py = seg.y * c;

    let color;
    if (i === 0) {
      color = COLORS.head;
    } else {
      const t = total <= 2 ? 1 : i / (total - 1);
      color = lerpColor(COLORS.bodyFrom, COLORS.bodyTo, t);
    }

    ctx.fillStyle = color;
    roundRect(px + pad, py + pad, c - pad * 2, c - pad * 2, radius);
    ctx.fill();

    if (i === 0) drawEyes(seg, state.direction);
  });
}

function drawEyes(head, dir) {
  const c = state.cellSize;
  const cx = head.x * c + c / 2;
  const cy = head.y * c + c / 2;
  const off  = c * 0.2;
  const eyeR = Math.max(1.2, c * 0.09);

  let e1x = cx, e1y = cy, e2x = cx, e2y = cy;
  if      (dir.x ===  1) { e1x = cx + off; e1y = cy - off; e2x = cx + off; e2y = cy + off; }
  else if (dir.x === -1) { e1x = cx - off; e1y = cy - off; e2x = cx - off; e2y = cy + off; }
  else if (dir.y === -1) { e1x = cx - off; e1y = cy - off; e2x = cx + off; e2y = cy - off; }
  else                   { e1x = cx - off; e1y = cy + off; e2x = cx + off; e2y = cy + off; }

  ctx.fillStyle = '#0b0d13';
  ctx.beginPath(); ctx.arc(e1x, e1y, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(e2x, e2y, eyeR, 0, Math.PI * 2); ctx.fill();
}

function drawGameOverOverlay() {
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = COLORS.overlayTxt;
  ctx.font = 'bold 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(state.won ? 'Победа!' : 'Игра окончена', LOGICAL_SIZE / 2, LOGICAL_SIZE / 2 - 34);

  ctx.fillStyle = COLORS.overlaySub;
  ctx.font = '18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Счёт: ${state.score}`, LOGICAL_SIZE / 2, LOGICAL_SIZE / 2 + 6);

  ctx.font = '14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Нажмите «Начать заново» или Space', LOGICAL_SIZE / 2, LOGICAL_SIZE / 2 + 40);
}

/* ---------- 7. ХЕЛПЕРЫ ---------- */

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}

function lerpColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r  = Math.round(pa.r + (pb.r - pa.r) * t);
  const g  = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function syncHud() {
  scoreEl.textContent = state.score;
  bestEl.textContent  = state.best;
  fieldEl.textContent = `${state.cols}×${state.rows}`;
  speedEl.textContent = (BASE_INTERVAL / state.moveInterval).toFixed(1) + '×';
}

/** Настройки недоступны, пока идёт партия. */
function updateSettingsEnabled() {
  const inProgress = state.running && !state.gameOver;
  sizeSelect.disabled   = inProgress;
  applesSelect.disabled = inProgress;
}

/* ---------- 8. ВВОД ---------- */

function queueDirection(dir) {
  if (!state.running || state.gameOver) return;

  // запрет мгновенного разворота — относительно применённого направления
  if (state.direction.x + dir.x === 0 && state.direction.y + dir.y === 0) return;

  if (state.nextDirection.x === dir.x && state.nextDirection.y === dir.y) return;
  state.nextDirection = dir;
}

document.addEventListener('keydown', event => {
  const dir = KEY_DIRECTIONS[event.key];
  if (dir) {
    event.preventDefault();
    queueDirection(dir);
    return;
  }

  if (event.code === 'Space' || event.key === 'Enter') {
    if (state.gameOver || !state.running) {
      event.preventDefault();
      startGame();
    }
  }
});

restartBtn.addEventListener('click', startGame);

/* ---------- 9. ИГРОВОЙ ЦИКЛ ---------- */

let rafId = 0;
let prevTimestamp = 0;

function gameLoop(timestamp) {
  rafId = requestAnimationFrame(gameLoop);

  if (prevTimestamp === 0) {
    prevTimestamp = timestamp;
    draw();
    return;
  }

  let dt = timestamp - prevTimestamp;
  prevTimestamp = timestamp;
  if (dt > 250) dt = 250;   // защита от «телепорта» после фоновой вкладки

  update(dt);
  draw();
}

/* ---------- 10. СТАРТ ---------- */

// Первичная синхронизация HUD с начальными значениями state
syncHud();
updateSettingsEnabled();

rafId = requestAnimationFrame(gameLoop);