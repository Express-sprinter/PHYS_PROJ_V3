import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/REPO_NAME/',  // <-- replace REPO_NAME with your GitHub repo name
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
