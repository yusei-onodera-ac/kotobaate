export const WORD_BANK = {
  動物: ['しまうま', 'にわとり', 'らいおん', 'きりん', 'かぴばら', 'いるか', 'こあら', 'ぺんぎん', 'ふくろう', 'たぬき'],
  食べ物: ['らあめん', 'おにぎり', 'たこやき', 'かれえ', 'すし', 'ぷりん', 'だんご', 'ころっけ', 'めろん', 'ぱんけえき'],
  植物: ['ひまわり', 'たんぽぽ', 'さくら', 'あさがお', 'すみれ', 'もみじ', 'ばら', 'ちゅうりっぷ', 'こすもす', 'なのはな'],
  乗り物: ['ひこうき', 'でんしゃ', 'じてんしゃ', 'ばす', 'ふね', 'とらっく', 'しんかんせん', 'たくしい'],
};

export const MODES = {
  normal: {
    id: 'normal',
    label: 'ノーマルモード',
    badge: 'NORMAL',
    icon: '🌼',
    description: '1問を解くまでじっくり挑戦。初めての人におすすめ。',
    timeLimit: null,
  },
  timeAttack: {
    id: 'timeAttack',
    label: 'タイムアタック',
    badge: '180 SEC',
    icon: '⏱️',
    description: '制限時間180秒で何問正解できるか競います。',
    timeLimit: 180,
  },
  daily: {
    id: 'daily',
    label: 'デイリーチャレンジ',
    badge: 'DAILY',
    icon: '🎀',
    description: '毎日同じ問題に挑戦。SNS共有やランキング向き。',
    timeLimit: null,
  },
};

export const DEFAULT_SETTINGS = {
  categories: Object.keys(WORD_BANK),
  difficulty: 'normal',
  effects: true,
};

export const DIFFICULTY_LENGTHS = {
  easy: [3, 4],
  normal: [3, 4, 5],
  hard: [4, 5, 6],
};

export function normalizeWord(word) {
  return word.trim().replace(/\s+/g, '').toLocaleLowerCase('ja-JP');
}

export function getWordLength(word) {
  return [...normalizeWord(word)].length;
}

export function isHiraganaWord(word) {
  return /^[\u3041-\u3096]+$/.test(normalizeWord(word));
}

export function validateGuess(answer, guess) {
  const normalizedGuess = normalizeWord(guess);
  const expectedLength = getWordLength(answer);
  if (!normalizedGuess) {
    return { isValid: false, message: '単語を入力してください。' };
  }
  if (!isHiraganaWord(normalizedGuess)) {
    return { isValid: false, message: 'ひらがなのみで入力してください。' };
  }
  if (getWordLength(normalizedGuess) !== expectedLength) {
    return { isValid: false, message: `${expectedLength}文字ぴったりで入力してください。` };
  }
  return { isValid: true, normalizedGuess };
}

export function evaluateGuess(answer, guess) {
  const answerChars = [...normalizeWord(answer)];
  const guessChars = [...normalizeWord(guess)];
  const usedAnswer = new Array(answerChars.length).fill(false);
  const usedGuess = new Array(guessChars.length).fill(false);
  let hits = 0;
  let blows = 0;

  guessChars.forEach((char, index) => {
    if (char === answerChars[index]) {
      hits += 1;
      usedAnswer[index] = true;
      usedGuess[index] = true;
    }
  });

  guessChars.forEach((char, guessIndex) => {
    if (usedGuess[guessIndex]) return;
    const answerIndex = answerChars.findIndex((answerChar, index) => !usedAnswer[index] && answerChar === char);
    if (answerIndex !== -1) {
      blows += 1;
      usedAnswer[answerIndex] = true;
    }
  });

  return { hits, blows, isCorrect: hits === answerChars.length && guessChars.length === answerChars.length };
}

export function getMaskedWord(word) {
  return '□'.repeat([...word].length);
}

export function flattenWords(settings = DEFAULT_SETTINGS) {
  const selected = settings.categories?.length ? settings.categories : DEFAULT_SETTINGS.categories;
  const allowedLengths = DIFFICULTY_LENGTHS[settings.difficulty] ?? DIFFICULTY_LENGTHS.normal;
  return selected.flatMap((category) =>
    (WORD_BANK[category] ?? [])
      .filter((word) => allowedLengths.includes([...word].length))
      .map((word) => ({ word, category })),
  );
}

export function hashString(value) {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.codePointAt(0)) | 0, 0) >>> 0;
}

export function createDailySeed(date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function pickWord({ settings = DEFAULT_SETTINGS, mode = 'normal', questionNumber = 1, date = new Date() } = {}) {
  const words = flattenWords(settings);
  if (!words.length) {
    return flattenWords(DEFAULT_SETTINGS)[0];
  }
  const seed = mode === 'daily' ? createDailySeed(date) : `${Date.now()}-${Math.random()}-${questionNumber}`;
  const index = hashString(`${seed}-${questionNumber}`) % words.length;
  return words[index];
}

export function getComboMultiplier(streak) {
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export function calculateScore({ attempts, seconds, streak }) {
  const speedBonus = Math.max(0, 180 - seconds) * 10;
  const attemptBonus = Math.max(0, 10 - attempts) * 100;
  return Math.round((1000 + speedBonus + attemptBonus) * getComboMultiplier(streak));
}
