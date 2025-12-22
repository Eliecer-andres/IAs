import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['exceljs', 'jszip', 'file-saver']
  },
  build: {
    commonjsOptions: {
      include: [/exceljs/, /node_modules/]
    }
  }
})
