import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('jspdf')) return 'jspdf';
          if (id.includes('mammoth')) return 'mammoth';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
