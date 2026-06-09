import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScore,
  createDailySeed,
  evaluateGuess,
  flattenWords,
  getComboMultiplier,
  getMaskedWord,
  isHiraganaWord,
  MODES,
  pickWord,
  validateGuess,
} from '../src/game.js';

test('ヒットは文字と位置が一致した数を返す', () => {
  assert.deepEqual(evaluateGuess('ひまわり', 'しまうま'), { hits: 1, blows: 0, isCorrect: false });
});

test('ブローは文字が含まれて位置が違う数を返す', () => {
  assert.deepEqual(evaluateGuess('ひまわり', 'にわとり'), { hits: 1, blows: 1, isCorrect: false });
});

test('共通文字がない場合はノーヒットノーブローになる', () => {
  assert.deepEqual(evaluateGuess('ひまわり', 'さんだる'), { hits: 0, blows: 0, isCorrect: false });
});

test('重複文字は使い回さずに評価する', () => {
  assert.deepEqual(evaluateGuess('たたき', 'きたた'), { hits: 1, blows: 2, isCorrect: false });
});

test('マスク表示は文字数分の四角を返す', () => {
  assert.equal(getMaskedWord('ひまわり'), '□□□□');
});

test('難易度ごとに単語の長さを絞り込める', () => {
  const words = flattenWords({ categories: ['動物'], difficulty: 'easy' });
  assert.ok(words.every(({ word }) => [3, 4].includes([...word].length)));
});

test('デイリーチャレンジは同じ日付なら同じ単語を選ぶ', () => {
  const date = new Date('2026-06-09T00:00:00Z');
  const first = pickWord({ mode: 'daily', questionNumber: 1, date });
  const second = pickWord({ mode: 'daily', questionNumber: 1, date });
  assert.deepEqual(first, second);
  assert.equal(createDailySeed(date), '2026-06-09');
});

test('コンボ倍率とスコアが増加する', () => {
  assert.equal(getComboMultiplier(2), 1);
  assert.equal(getComboMultiplier(3), 1.5);
  assert.ok(calculateScore({ attempts: 2, seconds: 20, streak: 5 }) > calculateScore({ attempts: 2, seconds: 20, streak: 1 }));
});


test('入力はひらがなのみ有効になる', () => {
  assert.equal(isHiraganaWord('ひらがな'), true);
  assert.equal(isHiraganaWord('カタカナ'), false);
  assert.equal(isHiraganaWord('らーめん'), false);
});

test('回答はひらがなかつ正解と同じ文字数だけ許可する', () => {
  assert.deepEqual(validateGuess('ひまわり', ' ひまわり '), { isValid: true, normalizedGuess: 'ひまわり' });
  assert.deepEqual(validateGuess('ひまわり', 'ひま'), { isValid: false, message: '4文字ぴったりで入力してください。' });
  assert.deepEqual(validateGuess('ひまわり', 'ヒマワリ'), { isValid: false, message: 'ひらがなのみで入力してください。' });
});

test('タイムアタックは180秒に設定されている', () => {
  assert.equal(MODES.timeAttack.timeLimit, 180);
  assert.equal(MODES.timeAttack.badge, '180 SEC');
});
