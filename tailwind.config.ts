import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: {
          50: 'var(--paper-50)',
          100: 'var(--paper-100)',
          200: 'var(--paper-200)',
          300: 'var(--paper-300)',
          400: 'var(--paper-400)',
        },
        rule: {
          200: 'var(--rule-200)',
          300: 'var(--rule-300)',
        },
        ink: {
          300: 'var(--ink-300)',
          400: 'var(--ink-400)',
          500: 'var(--ink-500)',
          700: 'var(--ink-700)',
          900: 'var(--ink-900)',
        },
        fill: {
          700: 'var(--ink-fill-700)',
          800: 'var(--ink-fill-800)',
          900: 'var(--ink-fill-900)',
        },
        sage: {
          100: 'var(--sage-100)',
          300: 'var(--sage-300)',
          500: 'var(--sage-500)',
          600: 'var(--sage-600)',
          700: 'var(--sage-700)',
        },
        clay: {
          100: 'var(--clay-100)',
          300: 'var(--clay-300)',
          500: 'var(--clay-500)',
          600: 'var(--clay-600)',
          700: 'var(--clay-700)',
        },
        ochre: {
          100: 'var(--ochre-100)',
          300: 'var(--ochre-300)',
          500: 'var(--ochre-500)',
          600: 'var(--ochre-600)',
          700: 'var(--ochre-700)',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Source Serif 4', 'Georgia', 'serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xs: '3px',
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
      spacing: {
        tap: '44px',
      },
      boxShadow: {
        'sh-1': 'var(--sh-1)',
        'sh-2': 'var(--sh-2)',
        'sh-3': 'var(--sh-3)',
        'sh-ink': 'var(--sh-ink)',
      },
      transitionTimingFunction: {
        flip: 'cubic-bezier(.2,.7,.2,1)',
      },
      transitionDuration: {
        nudge: '120ms',
        flip: '280ms',
        lift: '340ms',
        fade: '450ms',
      },
    },
  },
  plugins: [],
};

export default config;
