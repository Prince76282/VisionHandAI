/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Static cyberpunk tokens (always available)
        cyber: {
          dark: '#0a0d14',
          card: '#121826',
          border: '#1f293d',
          accent: '#06b6d4',
          neon: '#00f5d4',
          magenta: '#f72585',
          purple: '#7209b7',
        },
        // Semantic theme tokens — mapped to CSS vars
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          dark: "var(--primary-dark)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          hover: "var(--secondary-hover)",
          dark: "var(--secondary-dark)",
        },
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        muted: {
          foreground: "rgb(var(--color-muted-foreground) / <alpha-value>)",
        },
        background: "rgb(var(--color-background) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          deep: "rgb(var(--color-surface-deep) / <alpha-value>)",
        },
        border: "rgb(var(--color-border) / <alpha-value>)",
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "rgb(var(--color-accent-foreground) / <alpha-value>)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in-from-left': 'slideInLeft 0.3s ease-out forwards',
        'bounce-dot': 'bounceDot 1s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 15px rgba(79, 70, 229, 0.4)' },
          '100%': { boxShadow: '0 0 30px rgba(79, 70, 229, 0.8)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      }
    },
  },
  plugins: [],
}
