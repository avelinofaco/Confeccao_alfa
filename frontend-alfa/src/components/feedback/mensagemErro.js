/**
 * Extrai a mensagem amigável que o backend devolve em `detail`.
 * @param {unknown} erro erro do axios
 * @param {string} padrao texto usado quando não há detalhe
 * @returns {string}
 */
export function mensagemDeErro(erro, padrao) {
  const detalhe = erro?.response?.data?.detail;
  if (typeof detalhe === 'string') return detalhe;
  if (detalhe && typeof detalhe.mensagem === 'string') return detalhe.mensagem;
  if (Array.isArray(detalhe) && detalhe[0]?.msg) return detalhe[0].msg;
  return padrao;
}
