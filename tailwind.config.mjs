/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        grotesk: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        figtree: ['Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        // The Fika palette: white ground, a tinted surface for tiles, ink text.
        fika: {
          surface: '#F7F8FC',
          raised: '#EEF2FA',
          hover: '#E4EAF6',
          border: '#DEE0E5',
          text: '#111827',
          secondary: '#475467',
          tertiary: '#667085',
          accent: '#8BD42A',
          'accent-text': '#4A8C14',
          'accent-dim': 'rgba(139, 212, 42, 0.14)',
          green: '#16A34A',
          amber: '#D97706',
          red: '#E11D48',
          coral: '#FF7A6B',
        },
      },
    },
  },
  plugins: [],
};
