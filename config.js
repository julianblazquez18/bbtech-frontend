// Configuración de la URL del backend
// En producción apunta a Render, en desarrollo usa localhost:3000
if (window.location.hostname !== 'localhost') {
  window.BBTECH_API_URL = 'https://bbtech-api.onrender.com';
} else {
  window.BBTECH_API_URL = 'http://localhost:3000';
}