/** @type {import('tailwindcss').Config} */
import rac from 'tailwindcss-react-aria-components';
import colors from 'tailwindcss/colors';

export default {
  content: ['./node_modules/@ugrc/**/*.{tsx,jsx,js}', './index.html', './search.html', './src/**/*.{tsx,jsx,js}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F2F8F8',
          100: '#E4F1F0',
          200: '#C7E1DF',
          300: '#ACD2D1',
          400: '#8EC2C0',
          500: '#74B4B1',
          600: '#57A39F',
          700: '#498885',
          800: '#3B6D6B',
          900: '#2B504E',
          950: '#152827',
        },
        secondary: {
          50: '#F4F9FB',
          100: '#E9F2F6',
          200: '#D3E6EE',
          300: '#C1DBE6',
          400: '#ABCEDE',
          500: '#95C2D5',
          600: '#7FB5CC',
          700: '#69A9C4',
          800: '#539CBB',
          900: '#458FAE',
          950: '#234858',
        },
        accent: {
          50: '#f0d1c4',
          100: '#e1b7a5',
          200: '#d29d86',
          300: '#c28368',
          400: '#b36949',
          500: '#a44f2a',
          600: '#813e21',
          700: '#5d2d18',
          800: '#3a1c0f',
          900: '#160b06',
        },
        warning: colors.rose,
      },
      fontFamily: {
        utah: ['"Source Sans 3"', '"Source Sans Pro"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'gradient-x': 'gradient-x 4s ease infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },
    },
  },
  plugins: [rac],
};
