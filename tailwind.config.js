// filepath: tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx}", // Escanea todos los archivos relevantes en la carpeta src
    "./public/index.html",             // Incluye el archivo HTML principal si existe
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};