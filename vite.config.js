import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/Express-sprinter/PHYS_PROJ_V3/',  // <-- replace REPO_NAME with your GitHub repo name
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
