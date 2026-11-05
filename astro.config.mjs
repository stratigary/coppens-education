import { defineConfig } from 'astro/config';

export default defineConfig({
  // SITE_BASE is set by the deploy workflow: "/" for coppens.education,
  // "/coppens-education/" for the preview at <user>.github.io/coppens-education/.
  site: process.env.SITE_URL || 'https://coppens.education',
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
