/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class', // 使用 class 策略進行深夜模式切換
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        dark: {
          bg: '#121212',
          card: '#1e1e1e',
          border: '#2a2a2a',
          text: '#e0e0e0',
          muted: '#a0a0a0',
        },
      },
    },
  },
  plugins: [
    // 暫時註釋掉 typography 插件
    // require('@tailwindcss/typography'),
  ],
}; 