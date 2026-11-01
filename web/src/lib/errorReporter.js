// =============================================
// Saytdagi xatolarni serverga yuborish (admin paneldagi "Xatolar" bo'limi).
// Bir sessiyada ko'pi bilan 10 ta, bir xil xato bir marta; token va shaxsiy ma'lumot yuborilmaydi.
// =============================================

import { BACKEND_URL } from './api';

const MAX_REPORTS = 10;
const sent = new Set();

export function reportError(error, extra = {}) {
  try {
    const message = String(error?.message || error || 'Noma\'lum xato').slice(0, 1000);
    const key = `${message}|${String(error?.stack || '').split('\n')[1] || ''}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS) return;
    sent.add(key);
    const body = JSON.stringify({
      message,
      stack: String(error?.stack || extra.componentStack || '').slice(0, 4000),
      url: window.location.pathname
    });
    // keepalive: sahifa yopilayotganda ham yuboriladi (API boshqa domenda bo'lsa ham CORS bilan ishlaydi)
    fetch(`${BACKEND_URL}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // xato hisobotining o'zi xato bermasligi kerak
  }
}

export function installErrorReporter() {
  window.addEventListener('error', (event) => {
    // Rasm/skript yuklanmasligi (tarmoq) xato emas
    if (event.error || event.message) reportError(event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // API xatolari (tarmoq, 4xx) foydalanuvchiga ko'rsatiladi, ular dastur xatosi emas
    if (reason?.name === 'ApiError' || reason?.name === 'AbortError' || reason?.status !== undefined) return;
    reportError(reason);
  });
}
