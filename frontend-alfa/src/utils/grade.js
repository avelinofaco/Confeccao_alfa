/** Chave de uma célula da grade: "linha:coluna" (ex.: "3:12" = cor 3, tamanho 12). */
export const chaveCelula = (linha, coluna) => `${linha}:${coluna}`;

/** Soma os valores numéricos de um mapa {chave: número | ""}. */
export const somarValores = (valores) =>
  Object.values(valores).reduce((total, valor) => total + (Number(valor) || 0), 0);

/**
 * Converte {"linha:coluna": quantidade} em [{ linha, coluna, quantidade }] (linha e coluna numéricas).
 * Com `soPositivos` (padrão), descarta zeros e campos vazios.
 */
export function valoresParaLista(valores, { soPositivos = true } = {}) {
  return Object.entries(valores)
    .map(([chave, quantidade]) => {
      const [linha, coluna] = chave.split(':');
      return { linha: Number(linha), coluna: Number(coluna), quantidade: Number(quantidade) || 0 };
    })
    .filter((item) => !soPositivos || item.quantidade > 0);
}
