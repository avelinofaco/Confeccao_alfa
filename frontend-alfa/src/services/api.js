import axios from 'axios';

// Detecta inteligentemente: se tiver VITE_API_URL usa ela.
// Se estiver no localhost/127.0.0.1, conecta no backend local (http://localhost:8000).
// Em produção na nuvem, conecta na API do Render.
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8000';
  }
  return 'https://confeccao-alfa.onrender.com';
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Interceptador para anexa o Token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token_confeccao');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;