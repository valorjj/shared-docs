import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
  ],
})
