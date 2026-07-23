import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : fonctionne sur GitHub Pages (sous-dossier), Netlify, Vercel…
export default defineConfig({
  base: './',
  plugins: [react()],
});
