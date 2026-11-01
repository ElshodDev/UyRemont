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
