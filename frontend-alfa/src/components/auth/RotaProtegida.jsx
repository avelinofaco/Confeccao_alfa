import { Navigate } from 'react-router-dom';

/** Sem token, não entra: manda para o login. Antes disto dava para abrir /camisetas/… pela URL. */
export function RotaProtegida({ children }) {
  const token = localStorage.getItem('token_confeccao');
  return token ? children : <Navigate to="/" replace />;
}
