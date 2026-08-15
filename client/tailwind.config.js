/** @type {import('tailwindcss').Config} */
// Greenlight design tokens, ported from uxui/app/globals.css so the Expo client
// and the web app stay visually identical. Build brief §38: restrained colours,
// warm near-white canvas, near-black ink, green reserved for financial success.
// "Green should mean something. Do not make the entire app green."
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#faf9f5",
        ink: {
          DEFAULT: "#17171a",
          soft: "#55544d",
          muted: "#8a897f",
        },
        line: {
          DEFAULT: "#e7e4da",
          strong: "#d3d0c3",
        },
        card: "#ffffff",
        brand: {
          DEFAULT: "#1f5c3f",
          soft: "#e7f0ea",
        },
        success: {
          DEFAULT: "#1f7a4d",
          soft: "#e7f3ea",
        },
        warning: {
          DEFAULT: "#9c6b0b",
          soft: "#fbf1dc",
        },
        danger: {
          DEFAULT: "#b23a34",
          soft: "#fbeae8",
        },
      },
    },
  },
  plugins: [],
};
