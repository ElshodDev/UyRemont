import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Development rejimida backend (5000-port) so'rovlari proxy orqali yuboriladi
const backendUrl = process.env.VITE_DEV_BACKEND || 'http://localhost:5000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
