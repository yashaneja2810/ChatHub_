import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      external: [
        '@emoji-mart/react',
        '@emoji-mart/data',
        '@emoji-mart/data/sets/14/twitter.json'
      ],
      output: {
        globals: {
          '@emoji-mart/react': 'EmojiMartReact',
          '@emoji-mart/data': 'EmojiMartData'
        }
      }
    },
  },
  optimizeDeps: {
    include: ['@emoji-mart/react', '@emoji-mart/data'],
  },
});
