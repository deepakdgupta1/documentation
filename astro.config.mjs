// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import starlightLlmsTxt from 'starlight-llms-txt';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import mermaid from 'astro-mermaid';
import fs from 'node:fs';
import path from 'node:path';

// Resolve target repo root (set by CLI, defaults to engine's own root)
const targetRoot = process.env.TARGET_REPO_ROOT || path.resolve('.');
const docsDir = process.env.TARGET_DOCS_DIR || './src/content/docs';

// OpenAPI detection: check project root first, then docs directory
const openApiPath = [
  path.join(targetRoot, 'openapi.yaml'),
  path.join(targetRoot, 'openapi.json'),
  path.join(docsDir, 'openapi.yaml'),
  path.join(docsDir, 'openapi.json'),
].find((p) => fs.existsSync(p));

// https://astro.build/config
export default defineConfig({
  site: 'https://docs.sota-engine.local',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    mermaid({ autoTheme: true }),
    react(),
    starlight({
      title: 'SOTA Docs-as-Code',
      customCss: ['./src/styles/global.css'],
      components: {
        Footer: './src/components/CustomFooter.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: process.env.PUBLIC_GITHUB_REPO_URL || 'https://github.com/deepakdgupta1/documentation' },
      ],
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Example Guide', slug: 'guides/example' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'System Overview', slug: 'architecture/overview' },
            {
              label: 'Architecture Decision Records (ADRs)',
              items: [{ autogenerate: { directory: 'architecture/adr' } }],
            },
          ],
        },
        ...(openApiPath ? openAPISidebarGroups : []),
      ],
      plugins: [
        ...(openApiPath
          ? [starlightOpenAPI([{
              base: 'api',
              label: 'API Reference',
              schema: openApiPath,
            }])]
          : []),
        starlightLlmsTxt({
          rawContent: true
        }),
      ],
    })
  ],
  vite: {
    plugins: [tailwindcss()],
  }
});
