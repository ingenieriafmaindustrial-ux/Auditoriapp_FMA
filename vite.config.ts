import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Versión visible en el registro de errores: fecha y hora de compilación
  define: { __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          docx: ['docx'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
