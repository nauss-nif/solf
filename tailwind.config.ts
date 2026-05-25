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
          DEFAULT: '#203F40',
          hover:   '#2A4D4E',
          active:  '#2A6364',
          border:  'rgba(218, 219, 217, 0.18)',
          text:    '#E8ECEB',
        },
        primary: {
          DEFAULT: '#2A6364',
          hover:   '#245657',
          light:   '#E7F0F0',
          muted:   '#B5BDBE',
        },
        gold: {
          DEFAULT: '#C7B08C',
          hover:   '#BDA37A',
          light:   '#F3EDE3',
          muted:   '#6B5A4A',
        },
        surface: {
          50:  '#F9F9F9',
          100: '#DADBD9',
          200: '#B5BDBE',
          300: '#C7B08C',
          400: '#6B5A4A',
          500: '#5A5A5A',
          600: '#4F8F7A',
          700: '#2E6F8E',
          800: '#2A6364',
          900: '#1F3F40',
        },
        success: {
          DEFAULT: '#4F8F7A',
          light:   '#E7F3EE',
          dark:    '#2A6364',
        },
        warning: {
          DEFAULT: '#6B5A4A',
          light:   '#F3EDE3',
          dark:    '#6B5A4A',
        },
        danger: {
          DEFAULT: '#73384B',
          light:   '#F3E7EB',
          dark:    '#73384B',
        },
        info: {
          DEFAULT: '#2E6F8E',
          light:   '#E4EEF3',
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
        'glow-primary': '0 0 20px rgba(42,99,100,0.25)',
        'glow-gold':    '0 0 20px rgba(199,176,140,0.25)',
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
