import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: process.env.VITE_ALLOWED_HOSTS ? process.env.VITE_ALLOWED_HOSTS.split(',') : undefined,
  },
});
