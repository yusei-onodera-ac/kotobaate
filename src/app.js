import {
  DEFAULT_SETTINGS,
  MODES,
  WORD_BANK,
  calculateScore,
  createDailySeed,
  evaluateGuess,
  getComboMultiplier,
  getMaskedWord,
  normalizeWord,
  pickWord,
} from './game.js';

const STORAGE_KEYS = {
  settings: 'kotobaate:settings',
  records: 'kotobaate:records',
};

const state = {
  screen: 'home',
  mode: 'normal',
  settings: loadSettings(),
  records: loadRecords(),
  current: null,
  history: [],
  questionNumber: 1,
  streak: 0,
  solved: 0,
  startedAt: null,
  remaining: null,
  timerId: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.records) ?? '{}');
  } catch {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(state.records));
}

function showScreen(screen) {
  state.screen = screen;
  $$('.screen').forEach((element) => element.classList.toggle('active', element.id === screen));
  if (screen === 'ranking') renderRanking();
  if (screen === 'settings') renderSettings();
}

function renderModeCards() {
  $('#modeCards').innerHTML = Object.values(MODES)
    .map(
      (mode) => `
        <article class="mode-card">
          <div class="mode-icon" aria-hidden="true">${mode.icon}</div>
          <span>${mode.badge}</span>
          <h3>${mode.label}</h3>
          <p>${mode.description}</p>
          <button class="primary start-button" data-mode="${mode.id}">このモードで遊ぶ</button>
        </article>
      `,
    )
    .join('');
}

function startGame(modeId) {
  clearInterval(state.timerId);
  const mode = MODES[modeId] ?? MODES.normal;
  state.mode = mode.id;
  state.questionNumber = 1;
  state.streak = 0;
  state.solved = 0;
  state.remaining = mode.timeLimit;
  newQuestion();
  showScreen('game');
  if (mode.timeLimit) {
    state.timerId = setInterval(tickTimer, 1000);
  }
}

function newQuestion() {
  const selection = pickWord({ settings: state.settings, mode: state.mode, questionNumber: state.questionNumber });
  state.current = selection;
  state.history = [];
  state.startedAt = Date.now();
  $('#answerInput').disabled = false;
  $('#answerInput').value = '';
  $('#answerInput').focus();
  $('#nextButton').disabled = true;
  $('#resultCard').classList.add('hidden');
  $('#message').textContent = 'ヒントを元に単語を入力してください。';
  renderGame();
}

function renderGame() {
  const mode = MODES[state.mode];
  $('#gameModeLabel').textContent = mode.badge;
  $('#gameModeTitle').textContent = `問題 ${state.questionNumber}`;
  $('#maskedWord').textContent = getMaskedWord(state.current.word);
  $('#categoryHint').textContent = `カテゴリ：${state.current.category} / ${[...state.current.word].length}文字`;
  $('#timerPill').textContent = mode.timeLimit ? `残り ${state.remaining}秒` : '時間 ∞';
  $('#comboPill').textContent = `コンボ x${getComboMultiplier(state.streak).toFixed(1)}`;
  $('#historyList').innerHTML = state.history
    .map(
      (entry) => `
        <li>
          <strong>${entry.guess}</strong>
          <span>→ <b>${entry.hits}</b>ヒット <b>${entry.blows}</b>ブロー</span>
        </li>
      `,
    )
    .join('');
}

function submitGuess(event) {
  event.preventDefault();
  if (!state.current || $('#answerInput').disabled) return;
  const guess = normalizeWord($('#answerInput').value);
  if (!guess) {
    $('#message').textContent = '単語を入力してください。';
    return;
  }
  if (state.settings.strictLength && [...guess].length !== [...state.current.word].length) {
    $('#message').textContent = `${[...state.current.word].length}文字ぴったりで入力してください。`;
    return;
  }

  const result = evaluateGuess(state.current.word, guess);
  state.history.unshift({ guess, ...result });
  $('#answerInput').value = '';

  if (result.isCorrect) {
    completeQuestion(false);
  } else {
    $('#message').textContent = `${result.hits}ヒット${result.blows}ブロー。履歴から候補を絞りましょう。`;
  }
  renderGame();
}

function completeQuestion(gaveUp) {
  const seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  $('#answerInput').disabled = true;
  $('#nextButton').disabled = state.mode === 'daily' || Boolean(MODES[state.mode].timeLimit && state.remaining <= 0);
  if (gaveUp) {
    state.streak = 0;
    $('#resultTitle').textContent = 'ANSWER';
    $('#resultText').textContent = `正解は「${state.current.word}」でした。次はコンボをつなげよう。`;
  } else {
    state.streak += 1;
    state.solved += 1;
    const score = calculateScore({ attempts: state.history.length, seconds, streak: state.streak });
    recordResult({ score, seconds, attempts: state.history.length });
    $('#resultTitle').textContent = state.history.length === 1 ? 'PERFECT!!' : 'CLEAR!';
    $('#resultText').textContent = `正解「${state.current.word}」 / ${state.history.length}手 / ${seconds}秒 / ${score}点`;
    if (state.settings.effects) launchConfetti();
  }
  $('#resultCard').classList.remove('hidden');
  renderGame();
}

function recordResult(result) {
  const modeKey = state.mode === 'daily' ? `daily:${createDailySeed()}` : state.mode;
  const list = state.records[modeKey] ?? [];
  list.push({ ...result, solved: state.solved, streak: state.streak, date: new Date().toISOString() });
  state.records[modeKey] = list.sort((a, b) => b.score - a.score || a.seconds - b.seconds).slice(0, 10);
  saveRecords();
}

function nextQuestion() {
  if ($('#nextButton').disabled) return;
  state.questionNumber += 1;
  newQuestion();
}

function tickTimer() {
  state.remaining -= 1;
  renderGame();
  if (state.remaining <= 0) {
    clearInterval(state.timerId);
    $('#answerInput').disabled = true;
    $('#nextButton').disabled = true;
    $('#message').textContent = `タイムアップ！ 正解数は${state.solved}問でした。`;
    $('#resultTitle').textContent = 'TIME UP';
    $('#resultText').textContent = `60秒で${state.solved}問正解、最大${state.streak}コンボ。ランキングを確認しよう。`;
    $('#resultCard').classList.remove('hidden');
  }
}

function renderSettings() {
  $('#categoryOptions').innerHTML = Object.keys(WORD_BANK)
    .map(
      (category) => `
        <label><input type="checkbox" name="category" value="${category}" ${state.settings.categories.includes(category) ? 'checked' : ''} /> ${category}</label>
      `,
    )
    .join('');
  $$('input[name="difficulty"]').forEach((input) => {
    input.checked = input.value === state.settings.difficulty;
  });
  $('#effectsToggle').checked = state.settings.effects;
  $('#strictLengthToggle').checked = state.settings.strictLength;
}

function saveSettingsFromForm(event) {
  event.preventDefault();
  const categories = $$('input[name="category"]:checked').map((input) => input.value);
  state.settings = {
    categories: categories.length ? categories : DEFAULT_SETTINGS.categories,
    difficulty: $('input[name="difficulty"]:checked')?.value ?? 'normal',
    effects: $('#effectsToggle').checked,
    strictLength: $('#strictLengthToggle').checked,
  };
  saveSettings();
  $('#settings-title').textContent = '設定（保存しました）';
  setTimeout(() => ($('#settings-title').textContent = '設定'), 1300);
}

function renderRanking() {
  const entries = [
    ['normal', 'ノーマル'],
    ['timeAttack', 'タイムアタック'],
    [`daily:${createDailySeed()}`, '今日のデイリー'],
  ];
  $('#rankingGrid').innerHTML = entries
    .map(([key, label]) => {
      const rows = state.records[key] ?? [];
      return `
        <article class="ranking-card">
          <h3>${label}</h3>
          ${
            rows.length
              ? `<ol>${rows
                  .map(
                    (row) => `<li><strong>${row.score}点</strong><span>${row.attempts}手 / ${row.seconds}秒 / ${row.streak}コンボ</span></li>`,
                  )
                  .join('')}</ol>`
              : '<p>まだ記録がありません。</p>'
          }
        </article>
      `;
    })
    .join('');
}

function shareResult() {
  const text = `単語ヒット＆ブローで${state.solved}問正解！ ${state.streak}コンボ達成 #単語ヒットアンドブロー`;
  if (navigator.share) {
    navigator.share({ text }).catch(() => navigator.clipboard?.writeText(text));
  } else {
    navigator.clipboard?.writeText(text);
    $('#message').textContent = '共有テキストをコピーしました。';
  }
}

function launchConfetti() {
  const layer = $('#confettiLayer');
  layer.innerHTML = '';
  for (let i = 0; i < 80; i += 1) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = `hsl(${Math.random() * 360}, 90%, 60%)`;
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    layer.append(piece);
  }
  setTimeout(() => (layer.innerHTML = ''), 2200);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const navButton = event.target.closest('.nav-button');
    if (navButton) showScreen(navButton.dataset.screen);
    const startButton = event.target.closest('.start-button');
    if (startButton) startGame(startButton.dataset.mode);
  });
  $('#answerForm').addEventListener('submit', submitGuess);
  $('#nextButton').addEventListener('click', nextQuestion);
  $('#giveUpButton').addEventListener('click', () => completeQuestion(true));
  $('#settingsForm').addEventListener('submit', saveSettingsFromForm);
  $('#shareButton').addEventListener('click', shareResult);
}

renderModeCards();
renderSettings();
renderRanking();
bindEvents();
showScreen('home');
