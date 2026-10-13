'use strict';

/* ============================================================
   Лабораторная работа №5 — игра «Саймон» на чистом JavaScript.

   Ключевые идеи:
   • Никаких setInterval — только setTimeout, обёрнутый в Promise.
   • Очередь показа проигрывается через async/await, поэтому
     она линейна и всегда заканчивается.
   • Все таймеры хранятся в Map и гасятся при сбросе игры.
   • «Поколение» игры (sessionId) защищает от того, что старая
     async-цепочка продолжит работу после старта новой игры.
   • Состояние живёт в объекте state, а не в CSS-классах.
   ============================================================ */

/* ---------- 1. КОНСТАНТЫ ---------- */
const HIGHLIGHT_MS = 450;  // сколько горит сектор во время показа
const GAP_MS       = 200;  // пауза между секторами во время показа
const ROUND_DELAY  = 700;  // пауза перед началом нового раунда
const CLICK_MS     = 220;  // подсветка при клике игрока

// E4, C4, A3, E3 — приятный «минорный» аккорд, как в классическом Simon
const PAD_FREQS = [329.63, 261.63, 220.00, 164.81];

/* ---------- 2. ССЫЛКИ НА DOM ---------- */
const board    = document.getElementById('board');
const pads     = Array.from(board.querySelectorAll('.pad'));
const startBtn = document.getElementById('start-btn');
const levelEl  = document.getElementById('level');
const statusEl = document.getElementById('status');

/* ---------- 3. СОСТОЯНИЕ ИГРЫ ---------- */
const state = {
  sequence: [],      // последовательность индексов 0..3
  playerIndex: 0,    // сколько шагов игрок уже ввёл верно
  level: 0,          // текущий уровень = длина последовательности
  phase: 'idle',     // 'idle' | 'showing' | 'input' | 'gameover'
  timers: new Map(), // id таймера -> resolve соответствующего Promise
  sessionId: 0       // «поколение» игры
};

/* ---------- 4. ЗВУК (необязательный бонус) ---------- */
let audioCtx = null;

function playTone(index) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t    = audioCtx.currentTime;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = PAD_FREQS[index];

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.37);
  } catch (err) {
    // Звук ни при каких условиях не должен ломать игровую логику
  }
}

/* ---------- 5. ТАЙМЕРЫ ---------- */

/**
 * setTimeout, возвращающий Promise.
 * Промис резолвится либо по истечении времени,
 * либо принудительно — из clearAllTimers().
 */
function sleep(ms) {
  return new Promise(resolve => {
    const id = setTimeout(() => {
      state.timers.delete(id);
      resolve();
    }, ms);
    state.timers.set(id, resolve);
  });
}

/**
 * Гасит ВСЕ активные таймеры и разблокирует ожидающие их промисы.
 * Именно поэтому после игры не остаётся «висящих» setTimeout:
 * ни один из них не сработает позже и не вмешается в новую партию.
 */
function clearAllTimers() {
  for (const [id, resolve] of state.timers) {
    clearTimeout(id);
    resolve();            // разблокируем ожидающий код
  }
  state.timers.clear();
}

/**
 * Проверка актуальности игровой сессии.
 * Как только стартует новая игра, sessionId меняется,
 * и все старые цепочки молча выходят из функции.
 */
function isCurrent(sessionId) {
  return sessionId === state.sessionId;
}

/* ---------- 6. ОТРИСОВКА ---------- */

function setPhase(phase) {
  state.phase = phase;
  // Кликабельность падов определяется фазой, а не наоборот
  board.classList.toggle('is-locked', phase !== 'input');
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setLevel(n) {
  state.level = n;
  levelEl.textContent = n;
}

function highlight(index) {
  pads[index].classList.add('active');
}

function unhighlight(index) {
  pads[index].classList.remove('active');
}

function unhighlightAll() {
  pads.forEach(pad => pad.classList.remove('active'));
}

/* ---------- 7. ИГРОВОЙ ЦИКЛ ---------- */

function randomPadIndex() {
  return Math.floor(Math.random() * pads.length);
}

/**
 * Полный старт новой игры. Корректно убивает всё,
 * что осталось от предыдущей партии.
 */
function startGame() {
  // 1) Сначала «просрочиваем» все старые async-цепочки,
  //    потом гасим таймеры: продолжатели увидят чужой sessionId
  //    и выйдут, не тронув DOM.
  state.sessionId++;
  clearAllTimers();
  unhighlightAll();

  // 2) Сброс данных
  state.sequence = [];
  state.playerIndex = 0;
  setLevel(0);

  // 3) Первый раунд
  nextRound();
}

/**
 * Новый раунд: добавляет один шаг и проигрывает
 * всю последовательность с начала.
 */
async function nextRound() {
  const sessionId = state.sessionId;

  setLevel(state.level + 1);
  state.sequence.push(randomPadIndex());
  state.playerIndex = 0;

  setPhase('showing');
  setStatus('Смотрите внимательно…');

  // Пауза, чтобы игрок успел «переключиться» после прошлого раунда
  await sleep(ROUND_DELAY);
  if (!isCurrent(sessionId)) return;

  await playSequence(sessionId);
}

/**
 * Последовательно подсвечивает все секторы.
 * Клики игрока в это время игнорируются (phase === 'showing').
 */
async function playSequence(sessionId) {
  for (const padIndex of state.sequence) {
    if (!isCurrent(sessionId)) return;

    highlight(padIndex);
    playTone(padIndex);

    await sleep(HIGHLIGHT_MS);
    if (!isCurrent(sessionId)) return;

    unhighlight(padIndex);

    await sleep(GAP_MS);
  }

  if (!isCurrent(sessionId)) return;

  // Ход переходит игроку
  setPhase('input');
  setStatus('Ваш ход');
}

/**
 * Клик по сектору. Всё, что не фаза 'input', молча игнорируется.
 */
function handlePadPress(index) {
  if (state.phase !== 'input') return;

  // Визуальный и звуковой отклик
  highlight(index);
  playTone(index);
  sleep(CLICK_MS).then(() => unhighlight(index));

  const expected = state.sequence[state.playerIndex];

  // Ошибка — конец игры
  if (index !== expected) {
    gameOver();
    return;
  }

  state.playerIndex++;

  // Раунд пройден целиком — блокируем ввод и запускаем следующий
  if (state.playerIndex === state.sequence.length) {
    setPhase('showing');
    nextRound();
  }
}

function gameOver() {
  state.sessionId++;   // все старые цепочки становятся неактуальными
  clearAllTimers();    // и все таймеры гасятся
  unhighlightAll();
  setPhase('gameover'); // пады заблокированы

  setStatus(`Вы дошли до уровня ${state.level}. Игра окончена — нажмите «Старт».`);

  // Небольшая тряска поля. Отдельный одноразовый слушатель,
  // который сам себя снимает — утечек нет.
  board.classList.add('is-shaking');
  board.addEventListener(
    'animationend',
    () => board.classList.remove('is-shaking'),
    { once: true }
  );
}

/* ---------- 8. СОБЫТИЯ ---------- */

// Делегирование: один слушатель на всё поле
board.addEventListener('click', event => {
  const pad = event.target.closest('.pad');
  if (!pad) return;
  handlePadPress(Number(pad.dataset.index));
});

startBtn.addEventListener('click', startGame);

/* ---------- 9. ИНИЦИАЛИЗАЦИЯ ---------- */
setPhase('idle'); // пады заблокированы до первого «Старт»
setStatus('Нажмите «Старт», чтобы начать');