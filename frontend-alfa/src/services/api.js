import axios from 'axios';

const api = axios.create({
  // URL padrão onde o seu FastAPI roda. Ajuste se a porta for diferente.
  baseURL: 'http://localhost:8000', 
});

export default api;