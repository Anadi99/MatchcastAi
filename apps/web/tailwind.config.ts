import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0F1117',
        'bg-card': '#1A1D27',
        'bg-sponsor': '#1E2A1A',
        'accent-live': '#FF3B3B',
        'accent-pulse': '#3B82F6',
        'accent-gold': '#F59E0B',
        'text-primary': '#F0F0F0',
        'text-muted': '#6B7280',
      },
    },
  },
  plugins: [],
};

export default config;
