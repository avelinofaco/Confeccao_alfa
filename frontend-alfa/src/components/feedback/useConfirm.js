import { useContext } from 'react';
import { ConfirmContext } from './feedbackContexts';

/** Diálogo de confirmação que devolve Promise<boolean>. */
export function useConfirm() {
  const contexto = useContext(ConfirmContext);
  if (!contexto) {
    throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
  }
  return contexto;
}
