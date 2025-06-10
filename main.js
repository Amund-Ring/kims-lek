/* -----------------------------------------------------------------------------------
    Audio logic
----------------------------------------------------------------------------------- */
import { imageFiles } from '/images/imageFiles.js';

const audioFiles = {
  flip: '/audio/flip.mp3',
  cardDeal: '/audio/card_deal.mp3',
  select: '/audio/select.mp3',
  selectSuccess: '/audio/select_success.mp3',
  selectWrong: '/audio/select_wrong.mp3',
};

const flipSound = new Audio(audioFiles.flip);
flipSound.preload = 'auto';
flipSound.currentTime = 0;

const selectSound = new Audio(audioFiles.select);
selectSound.preload = 'auto';
selectSound.currentTime = 0;

const successSound = new Audio(audioFiles.selectSuccess);
successSound.preload = 'auto';
successSound.currentTime = 0;

const wrongSound = new Audio(audioFiles.selectWrong);
wrongSound.preload = 'auto';
wrongSound.currentTime = 0;

function playSound(sound) {
  sound.play();
  sound.currentTime = 0;
}

/* -----------------------------------------------------------------------------------
    Settings & State
----------------------------------------------------------------------------------- */
const difficultySettings = { easy: 3, medium: 4, hard: 5 };
let currentDifficulty = 'easy';
let gameInProgress = false;
let score = 0;
let mistakes = 0;
let boardPick = null;
let selectionPick = null;
let selectionWrapper = null;
let countdownInterval = null;
let matchCount = 0;
let currentRoundCards = [];
const matchedImages = [];

/* -----------------------------------------------------------------------------------
    Difficulty selector
----------------------------------------------------------------------------------- */

// Update difficulty and re-render board & selection.
function handleDifficultyChange(event) {
  currentDifficulty = event.target.value;
  const gameElementement = document.getElementById('game');
  gameElementement.classList.remove('easy', 'medium', 'hard');
  gameElementement.classList.add(currentDifficulty);
  renderBoard();
  renderSelectionArea();
}

// Attach change handlers to difficulty inputs.
function setupDifficultySelector() {
  document.querySelectorAll('input[name="difficulty"]').forEach(radio => {
    radio.addEventListener('change', handleDifficultyChange);
  });
}

/* -----------------------------------------------------------------------------------
    Image caching
----------------------------------------------------------------------------------- */
const imageCache = new Map();

// Retrieve from cache or create and cache a new <img> element.
function getOrCreateImage(src, alt = '') {
  if (imageCache.has(src)) {
    return imageCache.get(src).cloneNode();
  }
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  imageCache.set(src, img);
  return img.cloneNode();
}

/* -----------------------------------------------------------------------------------
    Initial setup
----------------------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  setupDifficultySelector();
  renderBoard();
  renderSelectionArea();
  document.getElementById('end-game-button').addEventListener('click', endGame);
  score = 0;
  mistakes = 0;
  updateScoreDisplay();
  updateMistakesDisplay();
});

// Force layout reflow on window resize
window.addEventListener('resize', () => {
  document.body.style.display = 'none';
  // eslint-disable-next-line no-void
  void document.body.offsetHeight;
  document.body.style.display = '';
});

/* -----------------------------------------------------------------------------------
    Board rendering
----------------------------------------------------------------------------------- */

// Build the game board grid and attach card click logic.
function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  const cols = difficultySettings[currentDifficulty];
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  const total = cols * cols;

  for (let i = 0; i < total; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    wrapper.innerHTML = `
      <div class="card">
        <div class="card-inner">
          <div class="card-back"></div>
          <div class="card-front card-face--hidden"></div>
        </div>
      </div>`;
    board.appendChild(wrapper);

    const card = wrapper.querySelector('.card');
    card.addEventListener('click', () => {
      if (!gameInProgress) return shakeCard(wrapper);
      if (!selectionPick || boardPick) return;

      boardPick = card;
      revealCard(card, true);

      setTimeout(() => {
        const selImg = selectionPick.querySelector('img').src;
        const bdImg = card.querySelector('img').src;
        const match = selImg === bdImg;

        if (match) {
          playSound(successSound);
          score++;
          matchCount++;
          updateScoreDisplay();
          selectionPick.classList.add('correct', 'matched');
          card.classList.add('correct');
          matchedImages.push(selImg.split('/').pop());

          if (matchedImages.length === currentRoundCards.length) {
            showGameComplete();
            return;
          }
          if (matchCount === difficultySettings[currentDifficulty]) {
            setTimeout(() => {
              refreshSelectionArea();
              matchCount = 0;
            }, 1500);
          }
        } else {
          playSound(wrongSound);
          mistakes++;
          score--;
          updateMistakesDisplay();
          updateScoreDisplay();
          selectionPick.classList.add('incorrect');
          card.classList.add('incorrect');
          shakeCard(selectionWrapper);
          shakeCard(wrapper);
        }

        setTimeout(() => {
          if (!match) {
            revealCard(card, false);
            selectionPick.classList.remove('selected', 'incorrect');
            card.classList.remove('incorrect');
          } else {
            selectionPick.classList.remove('selected');
          }
          boardPick = null;
          selectionPick = null;
          selectionWrapper = null;
        }, 300);
      }, 600);
    });
  }
}

/* -----------------------------------------------------------------------------------
    Selection area rendering
----------------------------------------------------------------------------------- */

// Build the selection panel and wire up the start button.
function renderSelectionArea() {
  const grid = document.querySelector('#selection-area .grid');
  grid.innerHTML = '';
  const startButton = document.getElementById('start-button');
  startButton.addEventListener('click', () => {
    playSound(flipSound);
    startGame();
  });

  const cols = difficultySettings[currentDifficulty];
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let i = 0; i < cols * 2; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    wrapper.innerHTML = `
      <div class="card ready">
        <div class="card-inner">
          <div class="card-back"></div>
          <div class="card-front card-face--hidden"></div>
        </div>
      </div>`;
    grid.appendChild(wrapper);

    const card = wrapper.querySelector('.card');
    card.addEventListener('click', () => {
      if (boardPick) return;
      if (selectionPick) selectionPick.classList.remove('selected');
      playSound(selectSound);
      selectionPick = card;
      selectionWrapper = wrapper;
      card.classList.add('selected');
    });
  }

  showGameInfo('ready');
}

/* -----------------------------------------------------------------------------------
    Gameplay logic
----------------------------------------------------------------------------------- */

// Start a new game round: deal, reveal, and prepare selection.
function startGame() {
  gameInProgress = true;
  clearMatchedFlags();
  matchCount = 0;
  matchedImages.length = 0;

  const duration = difficultySettings[currentDifficulty] ** 2 * 1000;
  showGameStatusPanel(true);

  renderBoardCards();
  const boardCards = document.querySelectorAll('#board .card');
  dealCards(boardCards);

  const dealDuration = 30 * boardCards.length + 100;
  setTimeout(() => {
    flipBoardCards(true);
    setTimeout(() => flipBoardCards(false), duration);
  }, dealDuration);

  startProgressBar(duration);
  showGameInfo('revealing');
  renderSelectionCards(duration);
}

// End the current game, reset state, and re-deal.
function endGame() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  gameInProgress = false;
  showGameStatusPanel(false);

  score = 0;
  mistakes = 0;
  boardPick = null;
  selectionPick = null;
  selectionWrapper = null;
  matchCount = 0;
  matchedImages.length = 0;

  updateScoreDisplay();
  updateMistakesDisplay();

  const boardCards = document.querySelectorAll('#board .card');
  const selCards = document.querySelectorAll('#selection-area .card');
  clearCards(boardCards);
  clearCards(selCards);
  clearMatchedFlags();

  setTimeout(() => {
    dealCards(boardCards);
    renderSelectionArea();
    showGameInfo('ready');
  }, 500);
}

// Shuffle an array randomly.
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// Pick a random subset of image filenames.
function getRandomCards(count) {
  return shuffle(imageFiles).slice(0, count);
}

// Build the selection list mixing board and fresh images.
function getSelectionCards(count) {
  const half = Math.floor(count / 2);
  const fromBoardPool = currentRoundCards.filter(
    name => !matchedImages.includes(name)
  );
  const fromBoard = shuffle(fromBoardPool).slice(0, half);
  const pool = imageFiles.filter(
    name => !currentRoundCards.includes(name) && !matchedImages.includes(name)
  );
  const fromOthers = shuffle(pool).slice(0, count - half);
  return shuffle([...fromBoard, ...fromOthers]);
}

// Convert a filename into human-readable alt text.
function getAltText(file) {
  return file
    .replace(/^img_\d+_/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Populate board cards with the current round images.
function renderBoardCards() {
  const cards = document.querySelectorAll('#board .card');
  const count = difficultySettings[currentDifficulty] ** 2;
  currentRoundCards = getRandomCards(count);
  cards.forEach((card, i) => {
    const front = card.querySelector('.card-front');
    front.innerHTML = '';
    front.appendChild(
      getOrCreateImage(
        `images/${currentRoundCards[i]}`,
        getAltText(currentRoundCards[i])
      )
    );
  });
}

// Refresh the selection area after a batch of matches.
function refreshSelectionArea() {
  if (!gameInProgress) return;
  const cards = document.querySelectorAll('#selection-area .card');
  clearCards(cards);
  const delay = 30 * cards.length + 200;

  setTimeout(() => {
    const needed = difficultySettings[currentDifficulty] * 2;
    const newSelection = getSelectionCards(needed);

    cards.forEach((cardElement, i) => {
      cardElement.classList.remove(
        'matched',
        'correct',
        'incorrect',
        'selected',
        'ready',
        'entered',
        'cleared',
        'flipped'
      );
      const front = cardElement.querySelector('.card-front');
      front.innerHTML = '';
      front.appendChild(
        getOrCreateImage(
          `images/${newSelection[i]}`,
          getAltText(newSelection[i])
        )
      );
      cardElement.classList.add('ready');
    });

    dealCards(cards);
    setTimeout(() => flipSelectionCards(true), 30 * cards.length + 500);
  }, delay);
}

// Flip a list of cards with a staggered delay.
function flipCards(list, show) {
  list.forEach((card, i) => setTimeout(() => revealCard(card, show), 100 * i));
}

// Flip all board cards up or down.
function flipBoardCards(show) {
  flipCards(document.querySelectorAll('#board .card'), show);
}

// Simple promise-based delay.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Render selection cards, deal them in, and flip up after delay.
async function renderSelectionCards(delay) {
  const cards = document.querySelectorAll('#selection-area .card');
  const count = difficultySettings[currentDifficulty] * 2;
  const half = count / 2;

  const fromBoard = shuffle(currentRoundCards).slice(0, half);
  const fromOthers = shuffle(
    imageFiles.filter(name => !currentRoundCards.includes(name))
  ).slice(0, half);
  const selection = shuffle([...fromBoard, ...fromOthers]);

  cards.forEach((card, i) => {
    card.classList.remove('card--invisible');
    const front = card.querySelector('.card-front');
    front.innerHTML = '';
    front.appendChild(
      getOrCreateImage(`images/${selection[i]}`, getAltText(selection[i]))
    );
  });

  await wait(delay + 100 * count);
  showGameInfo('hide');
  await wait(1000);
  dealCards(cards);
  await wait(100 * count);
  flipSelectionCards(true);
}

// Flip all selection cards up or down.
function flipSelectionCards(show) {
  flipCards(document.querySelectorAll('#selection-area .card'), show);
}

// Animate cards entering the view.
function dealCards(cards) {
  cards.forEach((card, i) =>
    setTimeout(() => card.classList.add('entered'), 30 * i)
  );
}

// Animate cards clearing and reset them to ready state.
function clearCards(cards) {
  cards.forEach((card, i) => {
    setTimeout(() => card.classList.add('cleared'), 30 * i);
    setTimeout(() => {
      revealCard(card, false);
      card.classList.replace('cleared', 'ready');
    }, 30 * i + 200);
  });
}

// Toggle a card's flipped state, playing sound if in progress.
function revealCard(card, show) {
  if (gameInProgress) playSound(flipSound);
  card.classList.toggle('flipped', show);
  setTimeout(() => {
    const back = card.querySelector('.card-back');
    const front = card.querySelector('.card-front');
    back.classList.toggle('card-face--hidden', show);
    front.classList.toggle('card-face--hidden', !show);
  }, 180);
}

// Shake a card wrapper to indicate invalid action.
function shakeCard(card) {
  card.classList.add('shake');
  card.addEventListener('animationend', () => card.classList.remove('shake'), {
    once: true,
  });
  const startButton = document.getElementById('start-button');
  startButton?.classList.add('pulse');
  startButton?.addEventListener(
    'animationend',
    () => startButton.classList.remove('pulse'),
    { once: true }
  );
}

// Update the on-screen score and its styling.
function updateScoreDisplay() {
  const el = document.getElementById('score');
  el.textContent = `Poeng: ${score}`;
  el.classList.remove('positive', 'negative', 'zero');
  if (score > 0) el.classList.add('positive');
  else if (score < 0) el.classList.add('negative');
  else el.classList.add('zero');
}

// Update the on-screen mistake counter.
function updateMistakesDisplay() {
  document.getElementById('left-info').textContent = `Feil: ${mistakes}`;
}

// Remove match/highlight classes from all cards.
function clearMatchedFlags() {
  document
    .querySelectorAll('#selection-area .card, #board .card')
    .forEach(card => {
      card.classList.remove('correct', 'matched', 'selected', 'incorrect');
    });
}

/* -----------------------------------------------------------------------------------
    UI Helpers
----------------------------------------------------------------------------------- */

// Toggle visibility of difficulty selector and status panel.
function showGameStatusPanel(show) {
  document
    .querySelector('#difficulty-selector')
    .classList.toggle('hidden', show);
  document.querySelector('#game-status').classList.toggle('hidden', !show);
}

// Animate the countdown bar and update the label each tick.
function startProgressBar(duration) {
  const bar = document.getElementById('countdown-bar');
  const fill = document.getElementById('countdown-fill');
  const label = document.getElementById('left-info');
  const start = Date.now();

  bar.classList.remove('invisible');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  label.textContent = `Tid: ${Math.ceil(duration / 1000)}s`;
  // eslint-disable-next-line no-void
  void fill.offsetWidth;
  fill.style.transition = `width ${duration}ms linear`;
  fill.style.width = '0%';

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const remaining = Math.max(0, duration - (Date.now() - start));
    label.textContent = `Tid: ${Math.ceil(remaining / 1000)}s`;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      bar.classList.add('invisible');
      updateMistakesDisplay();
    }
  }, 100);
}

// Show or hide overlays for 'ready' and 'revealing' states.
function showGameInfo(mode) {
  const overlay = document.getElementById('selection-overlay');
  const ready = document.getElementById('game-ready');
  const revealing = document.getElementById('game-revealing');
  const infoTextElementem = revealing.querySelector('.info-text');
  const needed = difficultySettings[currentDifficulty];

  infoTextElementem.innerHTML =
    `Memoriser kortene på brettet nå!<br>` +
    `Finn ${needed} kort her nede som matcher med brettet over.`;

  overlay.classList.toggle('hidden', mode === 'hide');
  ready.classList.toggle('hidden', mode !== 'ready');
  revealing.classList.toggle('hidden', mode !== 'revealing');
}

// Display completion overlay and wire up the restart button.
function showGameComplete() {
  gameInProgress = false;
  document
    .querySelectorAll('#selection-area .card-wrapper')
    .forEach(w => (w.style.visibility = 'hidden'));

  const overlay = document.getElementById('selection-overlay');
  const completedDiv = document.createElement('div');
  completedDiv.id = 'game-completed';

  
  const infoP = document.createElement('p');
  infoP.className = 'info-text';
  infoP.innerHTML = 'Gratulerer!<br>Du fant alle matchene 🎉';
  completedDiv.appendChild(infoP);

  const restartButton = document.createElement('button');
  restartButton.id = 'replay-button';
  restartButton.textContent = 'Spill igjen';
  completedDiv.appendChild(restartButton);

  overlay.appendChild(completedDiv);
  overlay.classList.remove('hidden');

  restartButton.addEventListener('click', () => {
    playSound(flipSound);
    completedDiv.style.display = 'none';
    overlay.classList.add('hidden');
    clearMatchedFlags();
    endGame();
    renderBoard();
    renderSelectionArea();
  });
}
