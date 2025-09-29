/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Premium Brand Colors
        'brand': {
          'navy': '#1B365D',      // Deep Navy Blue - Primary
          'royal': '#2E5984',     // Royal Blue - Secondary  
          'gold': '#C5A572',      // Champagne Gold - Accent
          'pearl': '#F8F9FA',     // Pearl White - Backgrounds
          'cloud': '#6C757D',     // Cloud Gray - Text
          'platinum': '#E9ECEF',  // Platinum - Borders/Dividers
          'soft-blue': '#8B9DC3', // Soft Blue - Subtle accents
        },
        // Legacy support for gradual migration
        'primary': '#1B365D',
        'secondary': '#C5A572',
        'accent': '#2E5984',
        // Semantic Colors
        'success': '#28A745',
        'warning': '#FFC107', 
        'error': '#DC3545',
        'info': '#17A2B8',
        // UI Colors
        'white': '#FFFFFF',
        'offwhite': '#F8F9FA',
        // Backwards compatibility (will be phased out)
        'olive': {
          DEFAULT: '#1B365D', // Map to navy for compatibility
          '50': '#F8F9FA',
          '100': '#E9ECEF', 
          '500': '#2E5984',
        },
        'navy': {
          DEFAULT: '#1B365D',
          '900': '#0F1419',
        },
        'sage': {
          DEFAULT: '#E9ECEF',
          '50': '#F8F9FA',
        },
      },
      fontFamily: {
        'inter': ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        'system': ['system-ui', 'sans-serif'],
      },
      lineHeight: {
        'relaxed': '1.5',
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        'card': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      transitionDuration: {
        '2000': '2000ms',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
