/** @type {import('tailwindcss').Config} */
// ============================================================
//  AKSHAYA VAULT — OBSIDIAN DESIGN SYSTEM v1.0
//  Theme: "Obsidian Vault" — Deep Basalt / Neon Emerald
//  Extracted from approved high-fidelity mockup (March 2026)
// ============================================================

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {

      // ── PILLAR 1: COLOR & DEPTH ─────────────────────────────
      colors: {

        // ── Depth Stack (Background Elevation Layers) ──────────
        // Each layer is ~7-8% lighter than the one below.
        // Use in strict order: void → base → surface → raised → overlay
        // ── Flat alias tokens (exact design spec) ──────────────
        'vault-bg':             '#060D0A',  // Main page background
        'vault-accent':         '#00D87A',  // Primary CTA, green headlines, positive pills
        'vault-card':           '#0E1713',  // Card background
        'vault-border':         '#1F2B24',  // Card / element border
        'vault-text-secondary': '#A0AAB2',  // Secondary body text
        'vault-text-muted':     '#6B7280',  // Muted / disabled text

        vault: {
          'void':    '#060D0A',  // L0 — Page canvas. The absolute darkest layer. Used as <body> bg.
          'base':    '#0A1410',  // L1 — Section alternating background. Subtle contrast from void.
          'surface': '#0E1713',  // L2 — Card background. The default card surface.
          'raised':  '#152518',  // L3 — Elevated card (hover state, modals, dropdowns).
          'border':  '#1F2B24',  // L4 — Default card/element border.
          'rim':     '#274436',  // L5 — Active/focused element border ring.
        },

        // ── Emerald Accent Scale ────────────────────────────────
        // Primary brand color. Used for all active, positive, and CTA states.
        emerald: {
          'bright':  '#00D87A',  // PRIMARY — Brightest accent. Hero text, chart peaks, CTA glow.
          'core':    '#00C46A',  // SECONDARY — Chart fills, active toggle, positive return values.
          'deep':    '#009952',  // TERTIARY — Darker green for gradient bottoms, large fills.
          'muted':   '#1A4D2E',  // BACKGROUND — Pill/badge background, chip fill (e.g. "+18.2%").
          'ghost':   '#0D2918',  // SUBTLE — Very faint tint behind emerald elements. Hover bg.
          'glow':    'rgba(0, 216, 122, 0.18)', // CSS GLOW — Box-shadow glow on cards, inputs.
          'glow-sm': 'rgba(0, 216, 122, 0.10)', // CSS GLOW — Soft glow for borders.
        },

        // ── Semantic Status Colors ──────────────────────────────
        // Strict usage: positive = gain/up, negative = loss/down, warning = drift/AMBER
        positive: {
          DEFAULT:   '#00E676',  // Matches emerald-bright. Never deviate.
          'dim':     '#00C46A',
          'bg':      '#1A4D2E',
        },
        negative: {
          DEFAULT:   '#FF4757',  // Red for loss/down/sell. Vivid against dark background.
          'dim':     '#CC394A',
          'bg':      '#3D1218',
        },
        warning: {
          DEFAULT:   '#FFB800',  // Amber for AMBER goal pulse, drift alerts.
          'dim':     '#CC9300',
          'bg':      '#3D2C00',
        },
        // Goal Pulse semantic aliases — use these, not raw colors
        pulse: {
          'green':   '#00E676',
          'amber':   '#FFB800',
          'red':     '#FF4757',
          'green-bg': '#1A4D2E',
          'amber-bg': '#3D2C00',
          'red-bg':   '#3D1218',
        },

        // ── Text Scale ──────────────────────────────────────────
        // Use in strict order: pure → silver → slate → dim → ghost
        ink: {
          'pure':    '#FFFFFF',  // H1, H2, primary financial numbers, KPI values.
          'silver':  '#C4CFC9',  // Body text, card subtitles, description copy.
          'slate':   '#7A8C84',  // Muted body, form labels, secondary metadata.
          'dim':     '#3D4F47',  // Disabled states, placeholder text.
          'ghost':   '#1E2C24',  // Barely visible — decorative lines, dividers.
        },

        // ── MD Design Tokens (from HTML reference files) ─────────
        // Used by the new revamped pages — mirrors the HTML tailwind config.
        'primary': '#44f593',
        'primary-container': '#00d87a',
        'primary-fixed': '#5cff9f',
        'primary-fixed-dim': '#25e283',
        'on-primary': '#00391c',
        'on-primary-fixed': '#00210e',
        'on-primary-container': '#00582e',
        'secondary': '#bacbbf',
        'secondary-container': '#3e4c44',
        'secondary-fixed': '#d6e7db',
        'secondary-fixed-dim': '#bacbbf',
        'on-secondary': '#25342c',
        'on-secondary-container': '#acbcb1',
        'on-secondary-fixed': '#101e17',
        'on-secondary-fixed-variant': '#3b4a42',
        'tertiary': '#d0dbd5',
        'tertiary-container': '#b4bfb9',
        'tertiary-fixed': '#dae5df',
        'tertiary-fixed-dim': '#bec9c3',
        'on-tertiary': '#29332f',
        'on-tertiary-container': '#444e49',
        'on-tertiary-fixed': '#141e1a',
        'on-tertiary-fixed-variant': '#3f4945',
        'surface': '#0d1512',
        'surface-dim': '#0d1512',
        'surface-bright': '#333b37',
        'surface-variant': '#2f3733',
        'surface-container-lowest': '#08100d',
        'surface-container-low': '#161d1a',
        'surface-container': '#19211e',
        'surface-container-high': '#242c28',
        'surface-container-highest': '#2f3733',
        'on-surface': '#dce5df',
        'on-surface-variant': '#bacbbb',
        'background': '#0d1512',
        'on-background': '#dce5df',
        'outline': '#859586',
        'outline-variant': '#3c4a3e',
        'error': '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',
        'on-error-container': '#ffdad6',
        'inverse-surface': '#dce5df',
        'inverse-on-surface': '#2a322e',
        'inverse-primary': '#006d3b',
        'surface-tint': '#25e283',

        // ── Legacy Support ───────────────────────────────────────
        // DEPRECATED — kept for backwards compatibility during migration.
        // Phase these out. Do NOT use in new components.
        'brand': {
          'navy':    '#1B365D',
          'royal':   '#2E5984',
          'gold':    '#C5A572',
          'pearl':   '#F8F9FA',
          'cloud':   '#6C757D',
          'platinum':'#E9ECEF',
        },
        'primary':   '#1B365D',
        'secondary': '#C5A572',
        'accent':    '#2E5984',
      },

      // ── PILLAR 2: TYPOGRAPHY ────────────────────────────────
      fontFamily: {
        // DISPLAY — Headlines, hero text, KPI numbers. Geometric, authoritative.
        'display': ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        // BODY — All body copy, labels, captions. High legibility.
        'body':    ['Inter', '"DM Sans"', 'system-ui', 'sans-serif'],
        // MONO — Numbers, prices, labels, metadata. Readable sans-serif (Inter).
        'mono':    ['Inter', '"DM Sans"', 'system-ui', 'sans-serif'],
        // Legacy compatibility
        'inter':   ['Inter', 'system-ui', 'sans-serif'],
        'system':  ['system-ui', 'sans-serif'],
      },

      fontSize: {
        // ── Type Scale ─────────────────────────────────────────
        // Extracted from mockup proportions. DO NOT deviate.
        'hero':   ['clamp(2.5rem, 5vw, 4rem)',    { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        // 40-64px — "Good morning, User." / "Experience the next evolution."
        'h1':     ['clamp(2rem, 3.5vw, 3rem)',     { lineHeight: '1.1',  letterSpacing: '-0.025em', fontWeight: '700' }],
        // 32-48px — Section H1s like "The Akshaya Ecosystem"
        'h2':     ['clamp(1.5rem, 2.5vw, 2rem)',   { lineHeight: '1.2',  letterSpacing: '-0.02em',  fontWeight: '600' }],
        // 24-32px — "Vault Intelligence"
        'h3':     ['clamp(1.125rem, 2vw, 1.5rem)', { lineHeight: '1.3',  letterSpacing: '-0.015em', fontWeight: '600' }],
        // 18-24px — Card titles like "Fund DNA", "Market Pulse"
        'h4':     ['1.125rem',                     { lineHeight: '1.4',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        // 18px — Subsection headings
        'body-lg':['1rem',                         { lineHeight: '1.6',  letterSpacing: '0',        fontWeight: '400' }],
        // 16px — Standard body
        'body':   ['0.9375rem',                    { lineHeight: '1.6',  letterSpacing: '0',        fontWeight: '400' }],
        // 15px — Card body copy
        'body-sm':['0.875rem',                     { lineHeight: '1.5',  letterSpacing: '0',        fontWeight: '400' }],
        // 14px — Secondary labels
        'caption':['0.8125rem',                    { lineHeight: '1.4',  letterSpacing: '0.01em',   fontWeight: '400' }],
        // 13px — Muted metadata
        'micro':  ['0.75rem',                      { lineHeight: '1.3',  letterSpacing: '0.02em',   fontWeight: '500' }],
        // 12px — "ROLLING RETURNS & RATIOS" type labels (uppercase, tracked)
        'label':  ['0.6875rem',                    { lineHeight: '1.2',  letterSpacing: '0.1em',    fontWeight: '600' }],
        // 11px — Uppercase section labels
      },

      // ── PILLAR 3: SPATIAL ARCHITECTURE ─────────────────────
      spacing: {
        // ── Spacing Tokens ────────────────────────────────────
        // Base unit: 4px. Multiples of 4 only.
        '18': '4.5rem',    // 72px — Section sub-gap
        '22': '5.5rem',    // 88px
        '30': '7.5rem',    // 120px — Large section padding
        '34': '8.5rem',    // 136px
        '120': '30rem',    // 480px — Fixed widths if needed
        '160': '40rem',    // 640px
      },

      // ── Container Widths ──────────────────────────────────────
      maxWidth: {
        'container': '1280px',  // Standard max-width for all page sections
        'prose':     '72ch',    // Readable prose width
        'card-sm':   '320px',
        'card-md':   '420px',
        'card-lg':   '560px',
      },

      // ── Border Radius ────────────────────────────────────────
      // All radii are on a geometric scale. DO NOT mix values.
      borderRadius: {
        'none':   '0',
        'xs':     '4px',   // Inline badges, micro chips
        'sm':     '6px',   // Small buttons, input fields
        'md':     '8px',   // Default buttons
        'lg':     '12px',  // Small cards, panels
        'xl':     '16px',  // Standard cards (PRIMARY card radius)
        '2xl':    '20px',  // Large feature cards
        '3xl':    '24px',  // Hero cards, modals
        'full':   '9999px', // Pills, toggle buttons, avatar circles
        // Aliases
        'card':   '16px',  // Use .rounded-card — primary card radius
        'button': '8px',   // Use .rounded-button — default button
        'pill':   '9999px',// Use .rounded-pill — for badges and tags
      },

      // ── Box Shadows (Elevation System) ──────────────────────
      // Each shadow creates a sense of physical depth above the vault-void.
      boxShadow: {
        // Standard elevation shadows (dark, use on cards)
        'card':      '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-md':   '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
        'card-lg':   '0 8px 32px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)',
        'card-hover':'0 12px 40px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.4)',
        // Emerald glow shadows — for active/focused/CTA elements
        'glow-sm':   '0 0 12px rgba(0,216,122,0.18)',
        'glow-md':   '0 0 24px rgba(0,216,122,0.22), 0 0 8px rgba(0,216,122,0.12)',
        'glow-lg':   '0 0 40px rgba(0,216,122,0.28), 0 0 16px rgba(0,216,122,0.18)',
        // Inset glow for active borders
        'glow-inset':'inset 0 0 12px rgba(0,216,122,0.08)',
        // Status glows
        'glow-red':  '0 0 16px rgba(255,71,87,0.25)',
        'glow-amber':'0 0 16px rgba(255,184,0,0.25)',
      },

      // ── Backdrop Blur (Glassmorphism) ────────────────────────
      backdropBlur: {
        'xs':   '2px',
        'sm':   '4px',
        'card': '12px',  // Standard glassmorphism card
        'modal':'20px',
        'hero': '32px',
      },

      // ── Animations & Transitions ────────────────────────────
      animation: {
        // Standard
        'fade-in':        'fadeIn 0.4s ease-out both',
        'fade-up':        'fadeUp 0.5s ease-out both',
        'slide-in-right': 'slideInRight 0.4s ease-out both',
        // Looping / Ambient
        'pulse-glow':     'pulseGlow 2.5s ease-in-out infinite',
        'ticker-scroll':  'tickerScroll 120s linear infinite',
        'float':          'float 6s ease-in-out infinite',
        // Data / Chart
        'bar-rise':       'barRise 0.8s cubic-bezier(0.34,1.56,0.64,1) both',
        'number-count':   'fadeIn 0.6s ease-out both',
      },

      transitionDuration: {
        '150':  '150ms',
        '200':  '200ms',
        '300':  '300ms',
        '500':  '500ms',
        '2000': '2000ms',
      },

      transitionTimingFunction: {
        'spring':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':  'cubic-bezier(0.4, 0, 0.2, 1)',
        'sharp':   'cubic-bezier(0.4, 0, 0.6, 1)',
      },

      keyframes: {
        fadeIn:       { '0%': { opacity: '0' },                          '100%': { opacity: '1' } },
        fadeUp:       { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(24px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        pulseGlow:    { '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(0,216,122,0.15)'  }, '50%': { opacity: '0.85', boxShadow: '0 0 24px rgba(0,216,122,0.35)' } },
        tickerScroll: { '0%': { transform: 'translateX(0)' },            '100%': { transform: 'translateX(-50%)' } },
        float:        { '0%, 100%': { transform: 'translateY(0)' },      '50%': { transform: 'translateY(-8px)' } },
        barRise:      { '0%': { transform: 'scaleY(0)', transformOrigin: 'bottom' }, '100%': { transform: 'scaleY(1)', transformOrigin: 'bottom' } },
      },

      // ── Grid & Layout ────────────────────────────────────────
      gridTemplateColumns: {
        'vault-3':   'repeat(3, minmax(0, 1fr))',       // Standard 3-col card grid
        'vault-stat':'repeat(auto-fit, minmax(200px, 1fr))', // Stat cards auto-flow
      },
    },
  },

  plugins: [
    // ── Plugin: Utility Classes ──────────────────────────────
    function({ addUtilities, addComponents, theme }) {
      addUtilities({
        // Scrollbar suppression
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        // Text rendering optimization for financial data
        '.text-numeric': {
          'font-variant-numeric': 'tabular-nums',
          'font-feature-settings': '"tnum" 1',
          'letter-spacing': '-0.01em',
        },
        // Glassmorphism utility
        '.glass': {
          'background': 'rgba(15, 29, 22, 0.6)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          'border': '1px solid rgba(0, 216, 122, 0.08)',
        },
        '.glass-strong': {
          'background': 'rgba(10, 20, 16, 0.85)',
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          'border': '1px solid rgba(0, 216, 122, 0.12)',
        },
        // Truncation with ellipsis
        '.truncate-2': {
          'overflow': 'hidden',
          'display': '-webkit-box',
          '-webkit-line-clamp': '2',
          '-webkit-box-orient': 'vertical',
        },
        // Shimmer loading state (dark variant)
        '.shimmer-dark': {
          'background': 'linear-gradient(90deg, #0F1D16 25%, #152518 50%, #0F1D16 75%)',
          'background-size': '200% 100%',
          'animation': 'tickerScroll 1.5s infinite',
        },
      });

      // All component classes defined in globals.css @layer components
    },
  ],
};
