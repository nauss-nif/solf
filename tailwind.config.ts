import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#0B1F17',
          hover:   '#142D20',
          active:  '#0D2A1C',
          border:  '#1A3527',
          text:    '#A8C5B8',
        },
        primary: {
          DEFAULT: '#1B4332',
          hover:   '#2D6A4F',
          light:   '#D1FAE5',
          muted:   '#6EE7B7',
        },
        gold: {
          DEFAULT: '#C9943A',
          hover:   '#D4A853',
          light:   '#FEF3C7',
          muted:   '#F59E0B',
        },
        surface: {
          50:  '#F0F5F2',
          100: '#E4EDE8',
          200: '#C8D9D0',
          300: '#9BBDAF',
          400: '#6B9A88',
          500: '#4A7A65',
          600: '#3A6050',
          700: '#2D4D40',
          800: '#1F3830',
          900: '#0D1F18',
        },
        success: {
          DEFAULT: '#059669',
          light:   '#D1FAE5',
          dark:    '#065F46',
        },
        warning: {
          DEFAULT: '#D97706',
          light:   '#FEF3C7',
          dark:    '#92400E',
        },
        danger: {
          DEFAULT: '#DC2626',
          light:   '#FEE2E2',
          dark:    '#991B1B',
        },
        info: {
          DEFAULT: '#2563EB',
          light:   '#DBEAFE',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tahoma', 'Arial', 'sans-serif'],
        mono: ['Cairo', 'Tahoma', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'xs':   '0.25rem',
        'sm':   '0.375rem',
        'md':   '0.5rem',
        'lg':   '0.75rem',
        'xl':   '1rem',
        '2xl':  '1.25rem',
        '3xl':  '1.5rem',
        '4xl':  '2rem',
      },
      boxShadow: {
        'card':    '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-md': '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
        'modal':   '0 8px 32px rgba(0,0,0,0.18), 0 32px 80px rgba(0,0,0,0.12)',
        'sidebar': '2px 0 20px rgba(0,0,0,0.15)',
        'glow-primary': '0 0 20px rgba(27,67,50,0.25)',
        'glow-gold':    '0 0 20px rgba(201,148,58,0.25)',
      },
      spacing: {
        sidebar: '260px',
        header:  '64px',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out both',
        'fade-up':    'fadeUp 0.4s ease-out both',
        'slide-in':   'slideIn 0.3s ease-out both',
        'shimmer':    'shimmer 1.5s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                          to: { opacity: '1' } },
        fadeUp:  { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
