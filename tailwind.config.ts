import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sand: '#F7F1E1',
        sandDeep: '#EDE3CC',
        terracotta: '#D95525',
        maroon: '#6B2C2C',
        olive: '#7D8B43',
        sun: '#E58C2A',
        ink: '#2A1E17',
      },
      boxShadow: {
        soft: '0 10px 20px -10px rgba(0,0,0,.15)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
}
export default config
