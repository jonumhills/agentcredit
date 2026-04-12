/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        okx: {
          bg:      "#000000",
          card:    "#0b0b0b",
          card2:   "#111111",
          border:  "#1f1f1f",
          border2: "#2a2a2a",
          green:   "#0ecb81",
          red:     "#f6465d",
          yellow:  "#f0b90b",
          blue:    "#3772ff",
          orange:  "#e8651a",
          muted:   "#848e9c",
          dim:     "#5e6673",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
