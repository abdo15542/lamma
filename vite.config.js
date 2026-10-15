import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(process.env.VITE_BUILD_SHA || 'dev')
  },
})
