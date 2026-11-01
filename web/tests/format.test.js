// Formatlash funksiyalari (brauzersiz ishlaydi)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, formatPriceRange, formatPhone, getOrderActions } from '../src/lib/format.js';

const plain = (text) => text.replace(/ /g, ' ');

describe('narxlar', () => {
  it('narx oralig\'i telefonda qisqa ko\'rinadi', () => {
    assert.equal(formatPriceRange(80000, 150000), '80–150 ming so\'m');
    assert.equal(formatPriceRange(600000, 3500000), '600 ming – 3,5 mln so\'m');
    assert.equal(formatPriceRange(3000000, 8000000), '3–8 mln so\'m');
    assert.equal(formatPriceRange(50000, null), '50 ming so\'mdan');
    assert.equal(formatPriceRange(1500000, 1500000), '1,5 mln so\'m');
  });

  it('narx yo\'q bo\'lsa "Kelishiladi"', () => {
    assert.equal(formatPrice(0), 'Kelishiladi');
    assert.equal(formatPrice(null), 'Kelishiladi');
    assert.equal(plain(formatPrice(150000)), '150 000 so\'m');
  });
});

describe('telefon', () => {
  it('raqamni o\'qishga qulay ko\'rsatadi', () => {
    assert.equal(formatPhone('+998901234567'), '+998 90 123 45 67');
    assert.equal(formatPhone(''), '');
  });
});

describe('buyurtma amallari', () => {
  const client = { id: 'c', role: 'client' };
  const master = { id: 'm', role: 'master' };

  it('ochiq buyurtmani usta ola oladi, mijoz bekor qiladi', () => {
    const order = { status: 'pending', client_id: 'c', master_id: null, mode: 'catalog' };
    assert.deepEqual(getOrderActions(order, master).map((a) => a.status), ['accepted']);
    assert.deepEqual(getOrderActions(order, client).map((a) => a.status), ['cancelled']);
  });

  it('tezkor chaqiruv amallari bu yerda emas', () => {
    assert.deepEqual(getOrderActions({ status: 'accepted', mode: 'instant', client_id: 'c' }, client), []);
  });
});
