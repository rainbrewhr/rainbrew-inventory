import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Stock status palette: muted emerald / amber / crimson
        status: { ok: '#059669', warn: '#D97706', crit: '#DC2626' },
      },
      boxShadow: {
        panel: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        float: '0 10px 30px -8px rgb(15 23 42 / 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
