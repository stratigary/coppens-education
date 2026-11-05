import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://coppens.education',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
