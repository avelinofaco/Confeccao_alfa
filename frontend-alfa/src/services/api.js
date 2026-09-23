import axios from 'axios';

const api = axios.create({
  // Pega a URL do Render em produção ou usa localhost em desenvolvimento local
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
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