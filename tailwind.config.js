import ugrcPreset from '@ugrc/tailwind-preset';
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./node_modules/@ugrc/**/*.{tsx,jsx,js}', './index.html', './src/**/*.{tsx,jsx,js}'],
  presets: [ugrcPreset],
  plugins: [],
};
