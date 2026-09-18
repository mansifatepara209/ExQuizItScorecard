/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quiz: {
          primary:   '#ffffff',
          secondary: '#faf7f8',
          accent:    '#f3e8ed',
          border:    '#e8d5dd',
          muted:     '#8a7379',
          text:      '#1a1a1a',
          gold:      '#C2185B',
          maroon:    '#8B1538',
          purple:    '#7B1FA2',
          orange:    '#F57C00',
          pink:      '#E91E63',
          success:   '#16a34a',
          danger:    '#dc2626',
        }
      },
      fontFamily: {
        display: ['"Inter"', '"Poppins"', 'system-ui', 'sans-serif'],
        body:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};