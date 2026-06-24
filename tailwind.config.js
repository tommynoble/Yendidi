module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Legacy tokens — values updated to new design system, names preserved
        // so existing classNames across all screens continue to work.
        'clay-primary':   '#BF592B', // was #D65A31 → Roasted Clay primary
        'brand-cream':    '#FFF8F6', // was #FDFBF7 → design system surface
        text: {
          main: '#231915', // was #2D241E → on-surface
          sub:  '#56423B', // was #6D6D6D → on-surface-variant
        },
        earth: {
          brown: '#4E342E', // kept
        },
        warm: {
          cream: '#FFF8F6', // was #FAF7F2
        },
        kente: {
          red:    '#BF592B', // remapped to primary
          yellow: '#FFCD00',
          green:  '#00A862', // remapped to tertiary
        },

        // Ghana's Hearth design system tokens
        primary: {
          DEFAULT:   '#BF592B',
          on:        '#FFFFFF',
          container: '#BC5729',
          'on-container': '#FFFBFF',
          fixed:     '#FFDBCE',
          'fixed-dim': '#FFB598',
          inverse:   '#FFB598',
        },
        secondary: {
          DEFAULT:   '#84523C',
          on:        '#FFFFFF',
          container: '#FDBA9F',
          'on-container': '#794833',
          fixed:     '#FFDBCD',
          'fixed-dim': '#FAB79C',
        },
        tertiary: {
          DEFAULT:   '#006A3C',
          on:        '#FFFFFF',
          container: '#00864D',
          'on-container': '#F6FFF5',
          fixed:     '#78FCAC',
          'fixed-dim': '#59DE92',
        },
        surface: {
          DEFAULT:    '#FFF8F6',
          dim:        '#E9D6CF',
          bright:     '#FFF8F6',
          lowest:     '#FFFFFF',
          low:        '#FFF1EC',
          container:  '#FEEAE2',
          high:       '#F8E4DD',
          highest:    '#F2DFD7',
          tint:       '#9F4114',
          variant:    '#F2DFD7',
        },
        'on-surface': {
          DEFAULT: '#231915',
          variant: '#56423B',
        },
        'inverse-surface': '#392E29',
        'inverse-on-surface': '#FFEDE6',
        outline: {
          DEFAULT: '#8A7269',
          variant: '#DDC1B6',
        },
        error: {
          DEFAULT:   '#BA1A1A',
          on:        '#FFFFFF',
          container: '#FFDAD6',
          'on-container': '#93000A',
        },
        neutral: '#83746E',
      },
      fontFamily: {
        // Mapped to Plus Jakarta Sans — same token names, new font
        serif:           ['PlusJakartaSans_700Bold', 'serif'],
        sans:            ['PlusJakartaSans_400Regular', 'sans-serif'],
        'sans-medium':   ['PlusJakartaSans_500Medium', 'sans-serif'],
        'sans-semibold': ['PlusJakartaSans_600SemiBold', 'sans-serif'],
        'sans-bold':     ['PlusJakartaSans_700Bold', 'sans-serif'],
      },
      borderRadius: {
        sm:   '0.25rem',  // 4px
        DEFAULT: '0.5rem', // 8px
        md:   '0.75rem',  // 12px
        lg:   '1rem',     // 16px
        xl:   '1.5rem',   // 24px
        full: '9999px',
      },
      spacing: {
        'mobile-margin': '1.25rem', // 20px
        gutter:          '1rem',    // 16px
        'stack-sm':      '0.5rem',  // 8px
        'stack-md':      '1rem',    // 16px
        'stack-lg':      '1.5rem',  // 24px
      },
    },
  },
  plugins: [],
}
