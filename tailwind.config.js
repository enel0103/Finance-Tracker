/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        income: '#10b981',
        expense: '#ef4444',
        invest: '#a855f7',
        savings: '#eab308'
      }
    }
  },
  plugins: []
}
