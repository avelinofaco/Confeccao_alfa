import api from './api';

/**
 * Busca várias URLs em paralelo sem deixar uma falha esconder as outras.
 * @param {string[]} urls
 * @returns {Promise<{ dados: any[][], houveFalha: boolean }>}
 */
export async function buscarEmParalelo(urls) {
  const resultados = await Promise.allSettled(urls.map((url) => api.get(url)));
  return {
    dados: resultados.map((r) => (r.status === 'fulfilled' ? r.value.data ?? [] : [])),
    houveFalha: resultados.some((r) => r.status === 'rejected'),
  };
}
