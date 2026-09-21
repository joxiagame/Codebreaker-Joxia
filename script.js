/* Codebreaker — logique de jeu, sons, scores et animations */
(function () {
  'use strict';

  const COLORS = [
    '#00ffa3', '#ff2a4d', '#ffcc00', '#ff6b12',
    '#8b5cf6', '#00d4ff', '#d946ef', '#e63946', '#2ec4b6'
  ];

  // --- État ---
  let secret = [];
  let triesLeft = 10;
  let maxTries = 10;
  let codeLen = 4;
  let colorCount = 6;
  let history = [];
  let currentGuess = [];
  let bestScore = 0;
  let muted = false;
  let gameOver = false;
  let player = 'Invité';
  let db = null;

  // --- Raccourcis DOM ---
  const $ = (id) => document.getElementById(id);
  const setupEl = $('setup');
  const gameArea = $('gameArea');
  const guessDisplay = $('guessDisplay');
  const paletteEl = $('palette');
  const submitBtn = $('submitBtn');
  const undoBtn = $('undoBtn');
  const historyEl = $('history');
  const triesLeftEl = $('triesLeft');
  const triesDotsEl = $('triesDots');
  const bestScoreEl = $('bestScore');
  const accountChipEl = $('accountChip');
  const accountNameEl = $('accountName');
  const helpOver = $('helpOver');
  const lenRange = $('lenRange');
  const colRange = $('colRange');
  const tryRange = $('tryRange');
  const lenVal = $('lenVal');
  const colVal = $('colVal');
  const tryVal = $('tryVal');
  const muteBtn = $('muteBtn');
  const winOver = $('winOver');
  const loseOver = $('loseOver');
  const winText = $('winText');
  const secretRevealWin = $('secretReveal');
  const secretRevealLose = $('secretRevealLose');
  const shareBtn = $('shareBtn');

  // --- Audio (Web Audio API) ---
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function tone(freq, duration, gain, type, delay) {
    if (muted) return;
    try {
      const c = getAudio();
      const t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + duration);
    } catch (e) {}
  }
  const sfx = {
    tap: () => tone(520, .07, .05),
    undo: () => tone(300, .07, .05),
    submit: () => tone(760, .12, .07),
    win: () => { tone(880, .15, .09); tone(1100, .15, .09, 'sine', .12); tone(1320, .25, .1, 'sine', .24); },
    lose: () => { tone(440, .2, .08); tone(330, .25, .08, 'sawtooth', .16); tone(220, .35, .08, 'sawtooth', .32); }
  };

  // --- Score & persistance ---
  const bestKey = () => 'codebreaker_best_' + codeLen + '_' + colorCount;
  function loadBest() {
    try { bestScore = parseInt(localStorage.getItem(bestKey())) || 0; } catch (e) { bestScore = 0; }
  }
  function saveBest(score) {
    try { localStorage.setItem(bestKey(), String(score)); } catch (e) {}
  }
  function loadMuted() {
    try { muted = localStorage.getItem('codebreaker_muted') === '1'; } catch (e) {}
  }

  // --- Firebase (classement hub) ---
  function initFirebase() {
    try {
      if (typeof firebase === 'undefined') return;
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: "AIzaSyCPecKQH6DURfYitjY4bXMeW0URLrcNnsI",
          authDomain: "joxiahub-2928b.firebaseapp.com",
          projectId: "joxiahub-2928b",
          storageBucket: "joxiahub-2928b.firebasestorage.app",
          messagingSenderId: "303698595695",
          appId: "1:303698595695:web:5c99c2cb2a9ea88e36a29a",
          databaseURL: "https://joxiahub-2928b-default-rtdb.europe-west1.firebasedatabase.app"
        });
      }
      db = firebase.database();
    } catch (e) { db = null; }
  }

  function saveScore(score) {
    if (!db || !player || player === 'Invité' || score <= 0) return;
    const path = 'games/CODEBREAKER/scores';
    db.ref(path).orderByChild('name').equalTo(player).once('value', (snap) => {
      let key = null, oldScore = 0;
      snap.forEach((child) => { key = child.key; oldScore = child.val().score || 0; });
      if (key && score > oldScore) {
        db.ref(path + '/' + key).update({ score: score, date: Date.now() });
      } else if (!key) {
        db.ref(path).push({ name: player, score: score, date: Date.now() });
      }
    }, () => {});
  }

  // --- Rendu ---
  function textOnColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150 ? '#0a0f14' : '#ffffff';
  }

  function renderPalette() {
    paletteEl.innerHTML = '';
    for (let i = 0; i < colorCount; i++) {
      const btn = document.createElement('button');
      btn.className = 'color-btn';
      btn.style.background = COLORS[i];
      btn.style.color = textOnColor(COLORS[i]);
      btn.textContent = String(i + 1);
      btn.setAttribute('aria-label', 'Couleur ' + (i + 1));
      btn.addEventListener('click', () => addColor(i));
      paletteEl.appendChild(btn);
    }
  }

  function renderGuess() {
    guessDisplay.innerHTML = '';
    for (let i = 0; i < codeLen; i++) {
      const slot = document.createElement('div');
      slot.className = 'guess-slot';
      if (i < currentGuess.length) {
        slot.classList.add('filled');
        slot.style.background = COLORS[currentGuess[i]];
      }
      guessDisplay.appendChild(slot);
    }
  }

  function renderTriesDots() {
    triesDotsEl.innerHTML = '';
    for (let i = 0; i < maxTries; i++) {
      const d = document.createElement('span');
      d.className = 'tries-dot' + (i < triesLeft ? '' : ' used');
      triesDotsEl.appendChild(d);
    }
  }

  function renderHistoryRow(guess, fb) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const pill = document.createElement('div');
    pill.className = 'guess-pill';
    for (let i = 0; i < guess.length; i++) {
      const d = document.createElement('div');
      d.className = 'dot filled';
      d.style.background = COLORS[guess[i]];
      pill.appendChild(d);
    }
    row.appendChild(pill);

    const fbDiv = document.createElement('div');
    fbDiv.className = 'feedback';
    let idx = 0;
    const addPeg = (cls) => {
      const p = document.createElement('div');
      p.className = 'fb ' + cls;
      p.style.animationDelay = (idx++ * 90) + 'ms';
      fbDiv.appendChild(p);
    };
    for (let i = 0; i < fb.correctPlace; i++) addPeg('b');
    for (let i = 0; i < fb.correctColor; i++) addPeg('m');
    const empty = Math.max(0, codeLen - fb.correctPlace - fb.correctColor);
    for (let i = 0; i < empty; i++) addPeg('empty');
    row.appendChild(fbDiv);
    return row;
  }

  function revealSecret(el, code) {
    el.innerHTML = '';
    for (let i = 0; i < code.length; i++) {
      const p = document.createElement('div');
      p.className = 'secret-peg';
      p.style.background = COLORS[code[i]];
      p.style.animationDelay = (i * 120) + 'ms';
      el.appendChild(p);
    }
  }

  // --- Logique de jeu ---
  function generateSecret() {
    secret = [];
    for (let i = 0; i < codeLen; i++) secret.push(Math.floor(Math.random() * colorCount));
  }

  function checkGuess(guess) {
    let correctPlace = 0, correctColor = 0;
    const secretCopy = secret.slice();
    const guessCopy = guess.slice();
    for (let i = 0; i < guessCopy.length; i++) {
      if (guessCopy[i] === secretCopy[i]) { correctPlace++; secretCopy[i] = -1; guessCopy[i] = -1; }
    }
    for (let i = 0; i < guessCopy.length; i++) {
      if (guessCopy[i] !== -1) {
        const idx = secretCopy.indexOf(guessCopy[i]);
        if (idx !== -1) { correctColor++; secretCopy[idx] = -1; }
      }
    }
    return { correctPlace, correctColor };
  }

  function addColor(idx) {
    if (gameOver || currentGuess.length >= codeLen || triesLeft <= 0) return;
    currentGuess.push(idx);
    renderGuess();
    submitBtn.disabled = currentGuess.length !== codeLen;
    sfx.tap();
  }

  function removeColor() {
    if (gameOver || currentGuess.length === 0) return;
    currentGuess.pop();
    renderGuess();
    submitBtn.disabled = true;
    sfx.undo();
  }

  function submitGuess() {
    if (gameOver || currentGuess.length !== codeLen || triesLeft <= 0) return;
    const fb = checkGuess(currentGuess);
    history.unshift({ guess: currentGuess.slice(), fb });
    historyEl.prepend(renderHistoryRow(currentGuess, fb));
    triesLeft--;
    triesLeftEl.textContent = triesLeft + ' essai' + (triesLeft > 1 ? 's' : '');
    renderTriesDots();
    currentGuess = [];
    renderGuess();
    submitBtn.disabled = true;
    sfx.submit();

    if (fb.correctPlace === codeLen) {
      win();
    } else if (triesLeft === 0) {
      lose();
    }
  }

  function computeScore() {
    return triesLeft * 100 + codeLen * 25 + colorCount * 15;
  }

  function win() {
    gameOver = true;
    const attempts = maxTries - triesLeft;
    const score = computeScore();
    if (score > bestScore) { bestScore = score; saveBest(score); }
    saveScore(score);
    bestScoreEl.textContent = 'Meilleur : ' + bestScore;
    triesLeftEl.textContent = 'RÉUSSI !';
    winText.textContent = 'Code cracké en ' + attempts + ' essai' + (attempts > 1 ? 's' : '') + ' · Score ' + score;
    revealSecret(secretRevealWin, secret);
    winOver.classList.remove('hidden');
    confetti();
    sfx.win();
  }

  function lose() {
    gameOver = true;
    triesLeftEl.textContent = '0 essai';
    revealSecret(secretRevealLose, secret);
    loseOver.classList.remove('hidden');
    loseOver.querySelector('.overlay-card').classList.add('shake');
    sfx.lose();
  }

  function confetti() {
    for (let i = 0; i < 42; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
      p.style.width = (6 + Math.random() * 6) + 'px';
      p.style.height = (10 + Math.random() * 8) + 'px';
      p.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
      p.style.animationDelay = (Math.random() * 0.5) + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4500);
    }
  }

  function shareResult() {
    const attempts = maxTries - triesLeft;
    const text = '🔓 CODEBREAKER · Joxia\n' +
      'Config : ' + codeLen + ' cases / ' + colorCount + ' couleurs / ' + maxTries + ' essais\n' +
      'Cracké en ' + attempts + ' essai' + (attempts > 1 ? 's' : '') + ' · Score ' + bestScore;
    const done = () => { shareBtn.textContent = '✅ Copié !'; setTimeout(() => { shareBtn.textContent = '📋 Copier le résultat'; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(done);
    } else {
      done();
    }
  }

  // --- Configuration ---
  function applyConfig() {
    codeLen = parseInt(lenRange.value);
    colorCount = parseInt(colRange.value);
    maxTries = parseInt(tryRange.value);
    lenVal.textContent = codeLen;
    colVal.textContent = colorCount;
    tryVal.textContent = maxTries;
  }

  function startGame() {
    applyConfig();
    triesLeft = maxTries;
    history = [];
    currentGuess = [];
    gameOver = false;
    loadBest();
    bestScoreEl.textContent = 'Meilleur : ' + (bestScore || '—');
    historyEl.innerHTML = '';
    generateSecret();
    renderPalette();
    renderGuess();
    renderTriesDots();
    triesLeftEl.textContent = triesLeft + ' essais';
    submitBtn.disabled = true;
    setupEl.classList.add('hidden');
    gameArea.classList.remove('hidden');
    try { getAudio().resume(); } catch (e) {}
    sfx.submit();
  }

  function resetGame() {
    setupEl.classList.remove('hidden');
    gameArea.classList.add('hidden');
    winOver.classList.add('hidden');
    loseOver.classList.add('hidden');
    lenRange.value = 4; colRange.value = 6; tryRange.value = 10;
    applyConfig();
    document.querySelectorAll('.preset').forEach((b) =>
      b.classList.toggle('active', b.dataset.len === '4' && b.dataset.col === '6' && b.dataset.try === '10'));
  }

  function bindPresets() {
    document.querySelectorAll('.preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        lenRange.value = btn.dataset.len;
        colRange.value = btn.dataset.col;
        tryRange.value = btn.dataset.try;
        applyConfig();
      });
    });
  }

  function clearPreset() {
    document.querySelectorAll('.preset').forEach((b) => b.classList.remove('active'));
  }
  function bindSliders() {
    lenRange.addEventListener('input', () => { lenVal.textContent = lenRange.value; clearPreset(); });
    colRange.addEventListener('input', () => { colVal.textContent = colRange.value; clearPreset(); });
    tryRange.addEventListener('input', () => { tryVal.textContent = tryRange.value; clearPreset(); });
  }

  // --- Clavier ---
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (gameArea.classList.contains('hidden') || gameOver || !helpOver.classList.contains('hidden')) return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < colorCount) addColor(idx);
      } else if (e.key === 'Backspace') {
        removeColor();
      } else if (e.key === 'Enter') {
        submitGuess();
      }
    });
  }

  // --- Son ---
  function bindMute() {
    loadMuted();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      muteBtn.textContent = muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-pressed', String(muted));
      try { localStorage.setItem('codebreaker_muted', muted ? '1' : '0'); } catch (e) {}
      if (!muted) sfx.tap();
    });
  }

  // --- Aide / tuto ---
  function bindHelp() {
    const closeHelp = () => helpOver.classList.add('hidden');
    $('helpBtn').addEventListener('click', () => helpOver.classList.remove('hidden'));
    document.querySelector('[data-close-help]').addEventListener('click', closeHelp);
    helpOver.addEventListener('click', (e) => { if (e.target === helpOver) closeHelp(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !helpOver.classList.contains('hidden')) closeHelp(); });
  }

  // --- Joueur (intégration hub ?player=) ---
  function bindPlayer() {
    const urlParams = new URLSearchParams(window.location.search);
    player = (urlParams.get('player') || '').trim() || 'Invité';
    accountNameEl.textContent = player;
    accountChipEl.classList.toggle('guest', player === 'Invité');
  }

  // --- Init ---
  function init() {
    initFirebase();
    bindPresets();
    bindSliders();
    bindKeyboard();
    bindMute();
    bindPlayer();
    bindHelp();
    $('startBtn').addEventListener('click', startGame);
    $('resetBtn').addEventListener('click', resetGame);
    submitBtn.addEventListener('click', submitGuess);
    undoBtn.addEventListener('click', removeColor);
    shareBtn.addEventListener('click', shareResult);
    document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => location.reload()));
    applyConfig();
    renderPalette();
    renderGuess();
    renderTriesDots();
  }

  init();
})();
