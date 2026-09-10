/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'quiz-primary': 'rgb(var(--quiz-primary) / <alpha-value>)',
        'quiz-secondary': 'rgb(var(--quiz-secondary) / <alpha-value>)',
        'quiz-accent': 'rgb(var(--quiz-accent) / <alpha-value>)',
        'quiz-gold': 'rgb(var(--quiz-gold) / <alpha-value>)',
        'quiz-text': 'rgb(var(--quiz-text) / <alpha-value>)',
        'quiz-muted': 'rgb(var(--quiz-muted) / <alpha-value>)',
        'quiz-border': 'rgb(var(--quiz-border) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}