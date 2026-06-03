import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Height-based breakpoints so full-screen layouts (login/activation) can
      // shrink their elements on short windows instead of clipping.
      screens: {
        short: { raw: '(max-height: 760px)' },
        shorter: { raw: '(max-height: 640px)' }
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      colors: {
        // Professional light palette. Primary = calm indigo/blue.
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#608cfa',
          500: '#3b66f5',
          600: '#2548ea',
          700: '#1d36d7',
          800: '#1e2fae',
          900: '#1e2d89',
          950: '#171d54'
        },
        // Neutral surfaces (light)
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a'
        }
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)',
        soft: '0 4px 16px rgba(15,23,42,0.06)',
        pop: '0 12px 40px rgba(15,23,42,0.14)'
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem'
      }
    }
  },
  plugins: []
} satisfies Config
