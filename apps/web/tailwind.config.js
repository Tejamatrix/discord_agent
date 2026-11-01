/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        // Neo-brutalist Vibrant Color Tokens
        neo: {
          bg: '#F5F3EF',       // Warm brutalist canvas
          darkBg: '#121212',   // Deep brutalist dark canvas
          card: '#FFFFFF',
          yellow: '#FFE600',   // Signature Canary Yellow
          yellowDark: '#E6CF00',
          lime: '#4ADE80',     // Electric Lime
          purple: '#A78BFA',   // Punchy Violet
          coral: '#FF6B6B',    // Vivid Coral / Red
          blue: '#38BDF8',     // Sky Electric Blue
          pink: '#F472B6',     // Pop Pink
          black: '#000000',
          white: '#FFFFFF',
          border: '#000000',
          slate: '#E2E8F0',
        },
      },
      boxShadow: {
        // Hard-edged Neubrutalism Drop Shadows (Zero blur)
        'neo-sm': '2px 2px 0px 0px #000000',
        'neo': '4px 4px 0px 0px #000000',
        'neo-lg': '6px 6px 0px 0px #000000',
        'neo-xl': '8px 8px 0px 0px #000000',
        'neo-white': '4px 4px 0px 0px #FFFFFF',
        'neo-yellow': '4px 4px 0px 0px #FFE600',
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
}
