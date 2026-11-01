import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Development rejimida backend (5000-port) so'rovlari proxy orqali yuboriladi
const backendUrl = process.env.VITE_DEV_BACKEND || 'http://localhost:5000'

// Saytning tavsifi va havola ko'rinishi (Telegram, WhatsApp). Production build'da PUBLIC_APP_URL
// (masalan https://usta24.uz) beriladi: rasm va sahifa manzili to'liq bo'lishi shart
const SITE_TITLE = 'Usta24 — Usta topish endi oson!'
const SITE_DESCRIPTION = 'Uy, avto va texnika ustalari: eng yaqin ustani bir tugma bilan chaqiring'

function siteMeta() {
  const base = (process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  const tags = [
    `<meta name="description" content="${SITE_DESCRIPTION}" />`,
    '<meta property="og:site_name" content="Usta24" />',
    '<meta property="og:locale" content="uz_UZ" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${SITE_TITLE}" />`,
    `<meta property="og:description" content="${SITE_DESCRIPTION}" />`,
    base && `<meta property="og:url" content="${base}/" />`,
    base && `<meta property="og:image" content="${base}/og.png" />`,
    base && '<meta property="og:image:width" content="1200" />',
    base && '<meta property="og:image:height" content="630" />',
    `<meta name="twitter:card" content="${base ? 'summary_large_image' : 'summary'}" />`
  ].filter(Boolean)
  return {
    name: 'usta24-site-meta',
    transformIndexHtml: (html) => html.replace(
      /<!-- og:start -->[\s\S]*?<!-- og:end -->/,
      `<!-- og:start -->\n    ${tags.join('\n    ')}\n    <!-- og:end -->`
    )
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), siteMeta()],
  server: {
    port: 3000,
    // Port band bo'lsa boshqasiga jim o'tib ketmasin (backend CORS faqat 3000 ni kutadi)
    strictPort: true,
    open: false,
    // Telefondan sinash: "npm run dev:phone" yaratadigan HTTPS havola (Cloudflare tunnel)
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': backendUrl,
      '/uploads': backendUrl,
      '/socket.io': { target: backendUrl, ws: true }
    }
  }
})
