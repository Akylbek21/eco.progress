export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        eco: {
          50: '#DDEEF7',
          100: '#BBD9EF',
          200: '#78B3DF',
          300: '#4A9BD7',
          400: '#0E5C9E',
          500: '#0A4A7F',
          600: '#0A3D70',
          700: '#063B6D',
          800: '#052E56',
          900: '#041F3F'
        },
        accent: '#DC2626' // красный для активного меню
      },
      backgroundImage: {
        'windmill': "url('https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1920&q=60')",
        'sky': "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=60')",
        'waves': "url('https://images.unsplash.com/photo-1505142468610-359e7d316be0?auto=format&fit=crop&w=1920&q=60')",
        'eco-energy': "url('https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1920&q=60')"
      }
    }
  },
  plugins: [],
};
