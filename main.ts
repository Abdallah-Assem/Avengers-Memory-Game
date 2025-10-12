console.log("running successfully");

interface Card {
  id: number;
  image: string;
  flipped: boolean;
  matched: boolean;
}

const images = [
  "Antman.jpg", "BlackPanther.jpg", "BlackWidow.jpg", "CaptainAmerica.jpg", "DoctorStrange.webp",
  "Hawkeye.png", "Hulk.png", "Ironman.jpg", "Spiderman.jpg", "Thor.png"
];

const flipSound = new Audio("./assets/audio/flip.mp3");
const failSound = new Audio("./assets/audio/fail.mp3");
const goodSound = new Audio("./assets/audio/good.mp3");
const gameOverSound = new Audio("./assets/audio/game-over.mp3");
const backgroundSound = new Audio("./assets/audio/fulltrack.mp3");
backgroundSound.loop = true;

let cards: Card[] = [];
let firstCard: Card | null = null;
let secondCard: Card | null = null;
let lockBoard = false;

const gameBoard = document.getElementById("gameBoard") as HTMLElement;
const restartBtn = document.getElementById("restartBtn") as HTMLButtonElement;
const progressBar = document.querySelector(".progress-bar") as HTMLElement;

function initGame(): void {
  firstCard = null;
  secondCard = null;
  lockBoard = false;

  cards = shuffle(
    [...images, ...images].map((img, index) => ({
      id: index,
      image: `./assets/images/${img}`,
      flipped: false,
      matched: false,
    }))
  );

  updateProgress();
  backgroundSound.currentTime = 0;
  backgroundSound.play();
  renderBoard();
}

function shuffle<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

function renderBoard(): void {
  gameBoard.innerHTML = "";
  cards.forEach((card, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";

    const inner = document.createElement("div");
    inner.className = "card-inner" + (card.flipped || card.matched ? " flipped" : "");


    const front = document.createElement("div");
    front.className = "card-face card-front";
    front.style.backgroundImage = `url(${card.image})`;


    const back = document.createElement("div");
    back.className = "card-face card-back";
    // back.innerText = String(index + 1);

    inner.appendChild(front);
    inner.appendChild(back);
    wrapper.appendChild(inner);

    wrapper.addEventListener("click", () => flipCard(card.id));

    gameBoard.appendChild(wrapper);
  });
}

function flipCard(id: number): void {
  if (lockBoard) return;

  const card = cards.find((c) => c.id === id);
  if (!card || card.flipped || card.matched) return;

  card.flipped = true;
  flipSound.play();

  if (!firstCard) {
    firstCard = card;
  } else if (!secondCard) {
    secondCard = card;
    checkMatch();
  }

  renderBoard();
}

function checkMatch(): void {
  if (!firstCard || !secondCard) return;

  if (firstCard.image === secondCard.image) {
    firstCard.matched = true;
    secondCard.matched = true;
    goodSound.play();
    resetTurn();
    updateProgress();

    if (cards.every((c) => c.matched)) {
      backgroundSound.pause();
      gameOverSound.play();
      setTimeout(() => alert("🥳 You Won 🎉"), 500);
    }
  } else {
    lockBoard = true;
    failSound.play();
    setTimeout(() => {
      firstCard!.flipped = false;
      secondCard!.flipped = false;
      resetTurn();
      renderBoard();
    }, 1000);
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
  progressBar.innerText = progress + "%";
}

restartBtn.addEventListener("click", () => {
  backgroundSound.pause();
  initGame();
});

initGame();




