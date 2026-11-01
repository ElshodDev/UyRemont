// Varaqa yordamchilari (brauzersiz ishlaydi)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTemporaryHost, shortUrl } from '../src/lib/print.js';

describe('varaqa', () => {
  it('vaqtinchalik manzillar aniqlanadi', () => {
    for (const host of ['localhost', '127.0.0.1', '192.168.1.5', 'abc-def.trycloudflare.com', 'app.localhost', 'pc.local', '::1', '']) {
      assert.equal(isTemporaryHost(host), true, host);
    }
  });

  it('haqiqiy domen vaqtinchalik emas', () => {
    for (const host of ['usta24.uz', 'www.usta24.uz', 'app.usta24.uz']) {
      assert.equal(isTemporaryHost(host), false, host);
    }
  });

  it('qisqa manzil', () => {
    assert.equal(shortUrl('https://usta24.uz', '/u/jasur'), 'usta24.uz/u/jasur');
    assert.equal(shortUrl('https://usta24.uz/', '/ustalar'), 'usta24.uz/ustalar');
  });
});

describe('komissiya', async () => {
  const { formatSum, debtStatus } = await import('../src/lib/commission.js');
  const plain = (text) => text.replace(/ /g, ' ');

  it('summa: nol va ishora bilan', () => {
    assert.equal(plain(formatSum(0)), '0 so\'m');
    assert.equal(plain(formatSum(15000)), '15 000 so\'m');
    assert.equal(plain(formatSum(-5000)), '−5 000 so\'m');
    assert.equal(plain(formatSum(15000, { sign: true })), '+15 000 so\'m');
    assert.equal(plain(formatSum(-60000, { sign: true })), '−60 000 so\'m');
  });

  it('qarz holati limitga qarab', () => {
    assert.equal(debtStatus(0, 200000).tone, 'ok');
    assert.equal(debtStatus(-1000, 200000).tone, 'ok');
    assert.equal(debtStatus(50000, 200000).tone, 'normal');
    assert.equal(debtStatus(170000, 200000).tone, 'warn');
    assert.equal(debtStatus(200001, 200000).tone, 'blocked');
    assert.equal(debtStatus(900000, 0).tone, 'normal', 'cheklov o\'chirilgan');
  });
});
