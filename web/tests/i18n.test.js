// Tarjimalar: koddagi har bir t('...') matnining ruscha tarjimasi bor, o'zgaruvchilar mos keladi
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ru from '../src/i18n/ru/index.js';
import { formatMessage } from '../src/i18n/index.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
// Admin panel faqat o'zbekcha (platforma egasi uchun)
const SKIP = [/[\\/]i18n[\\/]/, /[\\/]pages[\\/]Admin[^\\/]*\.jsx$/];

const sourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return sourceFiles(full);
  return /\.(js|jsx)$/.test(entry.name) && !SKIP.some((re) => re.test(full)) ? [full] : [];
});

// t('...'), t("..."), t(`...`) - birinchi argument matn bo'lishi kerak
const CALL = /(?<![\w.$])t\(\s*(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*[,)]/g;

const collectKeys = () => {
  const keys = new Map();
  const dynamic = [];
  for (const file of sourceFiles(SRC)) {
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(CALL)) {
      const [, quote, body] = match;
      const where = `${path.relative(SRC, file)}:${code.slice(0, match.index).split('\n').length}`;
      if (quote === '`' && body.includes('${')) {
        dynamic.push(where);
        continue;
      }
      // eslint-disable-next-line no-new-func
      const key = new Function(`return ${quote}${body}${quote};`)();
      if (!keys.has(key)) keys.set(key, where);
    }
  }
  return { keys, dynamic };
};

const placeholders = (text) => new Set([...text.matchAll(/\{(\w+)(?:,\s*plural)?/g)].map((m) => m[1]));

describe('tarjimalar', () => {
  const { keys, dynamic } = collectKeys();

  it('t() ga o\'zgaruvchili `${...}` matn berilmaydi (o\'rniga t(\'... {n}\', { n }))', () => {
    assert.deepEqual(dynamic, []);
  });

  it('koddagi har bir matnning ruscha tarjimasi bor', () => {
    const missing = [...keys].filter(([key]) => !(key in ru)).map(([key, where]) => `${where}  ${JSON.stringify(key)}`);
    assert.equal(missing.length, 0, `Tarjimasi yo'q (${missing.length}):\n${missing.join('\n')}`);
  });

  it('tarjimalarda o\'zgaruvchilar asl matndagi bilan bir xil, bo\'sh tarjima yo\'q', () => {
    const problems = [];
    for (const [key, value] of Object.entries(ru)) {
      if (typeof value !== 'string' || !value.trim()) {
        problems.push(`bo'sh: ${key}`);
        continue;
      }
      const a = [...placeholders(key)].sort().join(',');
      const b = [...placeholders(value)].sort().join(',');
      if (a !== b) problems.push(`${JSON.stringify(key)} {${a}} -> {${b}}`);
    }
    assert.deepEqual(problems, []);
  });
});

describe('formatMessage', () => {
  it('o\'zgaruvchilar va ruscha ko\'plik shakllari', () => {
    const template = '{n, plural, one {# отзыв} few {# отзыва} many {# отзывов} other {# отзыва}}';
    assert.equal(formatMessage(template, { n: 1 }, 'ru'), '1 отзыв');
    assert.equal(formatMessage(template, { n: 3 }, 'ru'), '3 отзыва');
    assert.equal(formatMessage(template, { n: 5 }, 'ru'), '5 отзывов');
    assert.equal(formatMessage(template, { n: 21 }, 'ru'), '21 отзыв');
    assert.equal(formatMessage('{n} ta sharh, {name}', { n: 4, name: 'Ali' }, 'uz'), '4 ta sharh, Ali');
  });
});
