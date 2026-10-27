// =============================================
// UyRemont - Backend API bilan ishlash
// =============================================

// Production da VITE_BACKEND_URL=https://api.uyremont.uz, development da Vite proxy
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
const API_URL = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'uyremont_token';

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // localStorage yopiq bo'lsa token faqat sessiya davomida xotirada qoladi
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // e'tiborsiz qoldiriladi
    }
  }
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/**
 * API so'rovi. Muvaffaqiyatsiz javobda ApiError tashlaydi.
 * @param {string} path - /masters kabi yo'l
 * @param {{ method?: string, body?: any, params?: Record<string, any>, signal?: AbortSignal, token?: string }} options
 */
export async function api(path, { method = 'GET', body, params, signal, token: tokenOverride } = {}) {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }

  const token = tokenOverride || tokenStorage.get();
  const isFormData = body instanceof FormData;
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(body !== undefined && !isFormData && { 'Content-Type': 'application/json' })
  };

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Server bilan bog\'lanib bo\'lmadi. Internet yoki backend ishlayotganini tekshiring.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // JSON bo'lmagan javob
  }

  if (!response.ok || data?.success === false) {
    if (response.status === 401 && token && !tokenOverride) {
      tokenStorage.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(data?.message || 'Kutilmagan xatolik yuz berdi', response.status, data);
  }

  return data;
}

/**
 * Backend dagi /uploads rasmlari uchun to'liq manzil
 */
export const assetUrl = (url) => (url && url.startsWith('/uploads/') ? `${BACKEND_URL}${url}` : url);
