import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three'],
          'react-three-vendor': ['@react-three/fiber', '@react-three/drei'],
          'esptool-vendor': ['esptool-js'],
          'icons-vendor': ['lucide-react'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'markdown-vendor': ['marked'],
        },
      },
    },
  },
});
