export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        eco: {
          50: '#EAF6FC',
          100: '#F4F8FB',
          200: '#87C9F9',
          300: '#58B6EE',
          400: '#0E5C9E',
          500: '#0D76B8',
          600: '#063B6D',
          700: '#063B6D',
          800: '#032B57',
          900: '#021C39',
        },
        accent: '#38C7BA',
      },
      backgroundImage: {
        windmill: "url('/pexels-jan-van.jpg')",
        sea: "url('/pexels-enginakyurt.jpg')",
      },
    },
  },
  plugins: [],
};
