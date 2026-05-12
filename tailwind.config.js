module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        kente: {
          red: '#C8102E',
          yellow: '#FFCD00',
          green: '#007A33',
        },
        earth: {
          brown: '#4E342E',
        },
        warm: {
          cream: '#FAF9F6',
        },
        clay: {
          primary: '#D65A31',
        },
        text: {
          main: '#2D241E',
          sub: '#6D6D6D',
        }
      },
      fontFamily: {
        serif: ['DMSerifDisplay_400Regular', 'serif'],
        sans: ['Inter_400Regular', 'sans-serif'],
        'sans-medium': ['Inter_500Medium', 'sans-serif'],
        'sans-semibold': ['Inter_600SemiBold', 'sans-serif'],
        'sans-bold': ['Inter_700Bold', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
