declare const bootstrap: any;

interface Card {
  id: number;
  pairId: string;
  image: string;
  flipped: boolean;
  matched: boolean;
}

const IMAGES = [
  "Antman.jpg", "BlackPanther.jpg", "BlackWidow.jpg", "CaptainAmerica.jpg", "DoctorStrange.webp",
  "Hawkeye.png", "Hulk.png", "Ironman.jpg", "Spiderman.jpg", "Thor.png"
];
const MISMATCH_DELAY = 900;
const BEST_KEY = "avengers-memory-best";
const MUTE_KEY = "avengers-memory-muted";

// ---------- Sound ----------
const flipSound = new Audio("./assets/audio/flip.mp3");
const failSound = new Audio("./assets/audio/fail.mp3");
const goodSound = new Audio("./assets/audio/good.mp3");
const gameOverSound = new Audio("./assets/audio/game-over.mp3");
const backgroundSound = new Audio("./assets/audio/fulltrack.mp3");
backgroundSound.loop = true;
backgroundSound.volume = 0.3;
backgroundSound.preload = "auto";
backgroundSound.addEventListener("error", () => {
  console.warn("Background music failed to load. Check that ./assets/audio/fulltrack.mp3 exists and is a valid mp3.");
});

let muted = readStorage(MUTE_KEY) === "1";

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

function playSound(sound: HTMLAudioElement): void {
  if (muted) return;
  sound.currentTime = 0;
  sound.play().catch(() => { /* blocked or missing file: ignore */ });
}
// musicWanted = "the game wants music right now" (true during play, false after a win).
// It lets us resume correctly after unmuting or returning to the tab.
let musicWanted = false;

function startMusic(): void {
  musicWanted = true;
  if (muted || !backgroundSound.paused) return;
  backgroundSound.play().catch((err) => console.warn("Background music could not play:", err));
}
function stopMusic(reset = false): void {
  musicWanted = false;
  backgroundSound.pause();
  if (reset) backgroundSound.currentTime = 0;
}

// Browsers only allow audio after a user gesture, so start the music on the first
// click, tap or key press anywhere on the page, not only on a card.
function unlockAudio(): void {
  startMusic();
  document.removeEventListener("pointerdown", unlockAudio);
  document.removeEventListener("keydown", unlockAudio);
}
document.addEventListener("pointerdown", unlockAudio);
document.addEventListener("keydown", unlockAudio);

// Pause when the tab is hidden, resume when it comes back.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) backgroundSound.pause();
  else if (musicWanted && !muted) backgroundSound.play().catch(() => {});
});

// ---------- State ----------
let cards: Card[] = [];
let cardEls = new Map<number, HTMLButtonElement>();
let firstCard: Card | null = null;
let secondCard: Card | null = null;
let lockBoard = false;
let moves = 0;
let timerId: number | null = null;
let startTime = 0;
let gameOver = false;

// ---------- DOM ----------
const gameBoard = document.getElementById("gameBoard") as HTMLElement;
const restartBtn = document.getElementById("restartBtn") as HTMLButtonElement;
const muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;
const playAgainBtn = document.getElementById("playAgainBtn") as HTMLButtonElement;
const progressBar = document.getElementById("progressBar") as HTMLElement;
const progressWrap = progressBar.parentElement as HTMLElement;
const movesEl = document.getElementById("moves") as HTMLElement;
const timerEl = document.getElementById("timer") as HTMLElement;
const bestEl = document.getElementById("best") as HTMLElement;
const winMovesEl = document.getElementById("winMoves") as HTMLElement;
const winTimeEl = document.getElementById("winTime") as HTMLElement;
const winRecordEl = document.getElementById("winRecord") as HTMLElement;
const winModal = new bootstrap.Modal(document.getElementById("winModal"));

// ---------- Helpers ----------
function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function getBest(): number | null {
  const v = Number(readStorage(BEST_KEY));
  return v > 0 ? v : null;
}

// ---------- Game flow ----------
function initGame(): void {
  stopTimer();
  firstCard = null;
  secondCard = null;
  lockBoard = false;
  gameOver = false;
  moves = 0;
  movesEl.textContent = "0";
  timerEl.textContent = "0:00";
  bestEl.textContent = getBest() ? String(getBest()) : "–";

  cards = shuffle(
    [...IMAGES, ...IMAGES].map((img, index) => ({
      id: index,
      pairId: img,
      image: `./assets/images/${img}`,
      flipped: false,
      matched: false,
    }))
  );

  updateProgress();
  buildBoard();
}

// Build the board once; later changes only toggle CSS classes so the flip animation plays.
function buildBoard(): void {
  gameBoard.innerHTML = "";
  cardEls = new Map();

  cards.forEach((card) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-wrapper";
    btn.setAttribute("aria-label", "Hidden card");
    btn.innerHTML =
      '<span class="card-inner"><span class="card-face card-front"></span><span class="card-face card-back"></span></span>';
    (btn.querySelector(".card-front") as HTMLElement).style.backgroundImage = `url("${card.image}")`;
    btn.addEventListener("click", () => flipCard(card));
    gameBoard.appendChild(btn);
    cardEls.set(card.id, btn);
  });
}

function setFlipped(card: Card, flipped: boolean): void {
  card.flipped = flipped;
  const el = cardEls.get(card.id)!;
  el.classList.toggle("flipped", flipped);
  el.setAttribute("aria-label", flipped ? card.pairId.replace(/\.\w+$/, "") : "Hidden card");
}

function flipCard(card: Card): void {
  if (lockBoard || gameOver || card.flipped || card.matched) return;

  if (!timerId) startTimer();
  if (!musicWanted) startMusic();

  setFlipped(card, true);
  playSound(flipSound);

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  lockBoard = true;
  moves++;
  movesEl.textContent = String(moves);
  checkMatch();
}

function checkMatch(): void {
  if (!firstCard || !secondCard) return;
  const a = firstCard;
  const b = secondCard;

  if (a.pairId === b.pairId) {
    a.matched = b.matched = true;
    cardEls.get(a.id)!.classList.add("matched");
    cardEls.get(b.id)!.classList.add("matched");
    playSound(goodSound);
    resetTurn();
    updateProgress();

    if (cards.every((c) => c.matched)) endGame();
  } else {
    playSound(failSound);
    cardEls.get(a.id)!.classList.add("wrong");
    cardEls.get(b.id)!.classList.add("wrong");
    setTimeout(() => {
      cardEls.get(a.id)!.classList.remove("wrong");
      cardEls.get(b.id)!.classList.remove("wrong");
      setFlipped(a, false);
      setFlipped(b, false);
      resetTurn();
    }, MISMATCH_DELAY);
  }
}

function resetTurn(): void {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
}

function updateProgress(): void {
  const matchedCount = cards.filter((c) => c.matched).length;
  const progress = Math.round((matchedCount / cards.length) * 100);
  progressBar.style.width = progress + "%";
  progressBar.textContent = progress + "%";
  progressWrap.setAttribute("aria-valuenow", String(progress));
}

function endGame(): void {
  gameOver = true;
  const elapsed = Date.now() - startTime;
  stopTimer();
  timerEl.textContent = formatTime(elapsed);
  stopMusic(true);
  playSound(gameOverSound);

  const best = getBest();
  if (!best || moves < best) {
    writeStorage(BEST_KEY, String(moves));
    bestEl.textContent = String(moves);
    winRecordEl.textContent = best ? "New best score!" : "First record saved.";
  } else {
    winRecordEl.textContent = `Your best is ${best} moves.`;
  }
  winMovesEl.textContent = String(moves);
  winTimeEl.textContent = formatTime(elapsed);

  setTimeout(() => winModal.show(), 700);
}

// ---------- Timer ----------
function startTimer(): void {
  startTime = Date.now();
  timerId = window.setInterval(() => {
    timerEl.textContent = formatTime(Date.now() - startTime);
  }, 250);
}
function stopTimer(): void {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ---------- Controls ----------
function updateMuteButton(): void {
  muteBtn.textContent = muted ? "Sound off" : "Sound on";
  muteBtn.setAttribute("aria-pressed", String(muted));
}

muteBtn.addEventListener("click", () => {
  muted = !muted;
  writeStorage(MUTE_KEY, muted ? "1" : "0");
  if (muted) backgroundSound.pause();
  else if (musicWanted) startMusic();
  updateMuteButton();
});

restartBtn.addEventListener("click", () => {
  initGame();
  startMusic(); // keeps playing if it already is, restarts it after a win
});
playAgainBtn.addEventListener("click", () => {
  winModal.hide();
  initGame();
  startMusic();
});

// Preload images so cards never flash blank when first flipped
IMAGES.forEach((img) => { new Image().src = `./assets/images/${img}`; });

updateMuteButton();
initGame();
