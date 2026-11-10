import { useContext } from 'react';
import { ToastContext } from './feedbackContexts';

/** Avisos rápidos no canto da tela. Ex.: toast.sucesso('Pedido salvo'). */
export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  }
  return contexto;
}
