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
        primary: '#016564',
        secondary: '#d0b284',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
      },
      fontFamily: { sans: ['Cairo', 'sans-serif'] }
    },
  },
  plugins: [],
}
export default config
