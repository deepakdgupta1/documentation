// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import starlightOpenAPI, { openAPISidebarGroups } from 'starlight-openapi';
import starlightLlmsTxt from 'starlight-llms-txt';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://docs.sota-engine.local',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    react(),
    starlight({
      title: 'SOTA Docs-as-Code',
      customCss: ['./src/styles/global.css'],
      components: {
        Footer: './src/components/CustomFooter.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }
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
        ...openAPISidebarGroups,
      ],
      plugins: [
        starlightOpenAPI([
          {
            base: 'api',
            label: 'API Reference',
            schema: './openapi.yaml',
          }
        ]),
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