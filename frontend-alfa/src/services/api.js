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

// Uma tela faz várias chamadas em paralelo; com o token vencido, todas voltam 401 ao mesmo tempo.
// Sem esta trava, cada uma dispararia a sua navegação e o navegador abortaria as anteriores.
let derrubandoSessao = false;

// Sessão expirada ou token inválido: limpa e volta ao login, em vez de deixar a tela vazia.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const ehTentativaDeLogin = erro.config?.url?.includes('/login');
    if (erro.response?.status === 401 && !ehTentativaDeLogin && !derrubandoSessao) {
      derrubandoSessao = true;
      localStorage.removeItem('token_confeccao');
      localStorage.removeItem('usuario_confeccao');
      if (window.location.pathname !== '/') {
        window.location.assign('/?sessao=expirada');
      } else {
        derrubandoSessao = false;
      }
    }
    return Promise.reject(erro);
  },
);

export default api;