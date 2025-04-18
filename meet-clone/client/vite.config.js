import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'c3fa-181-78-107-102.ngrok-free.app' // 👈 pon aquí la URL de Ngrok
    ]
  }
})
