/**
 * Formatação de números para a interface, sempre em pt-BR.
 *
 * Regra que originou este módulo: `toFixed()` imprime ponto decimal, e um leitor
 * brasileiro lê "20.000 kg" como vinte mil quilos. O peso de malha aparecia assim na
 * listagem de Corte e Rendimento enquanto o KPI logo acima, no mesmo ecrã, mostrava
 * "20,0 kg" — o mesmo número em dois formatos.
 *
 * Então: para texto que o usuário lê, use as funções deste módulo. `toFixed()` fica
 * reservado ao que precisa de ponto decimal — valor de `<input type="number">` e corpo
 * de requisição — e para isso existe `paraCampoNumerico()`.
 */

const LOCALE = 'pt-BR';

export const formatarNumero = (valor, { min = 0, max = 3 } = {}) => {
  const numero = Number(valor ?? 0);
  // Texto não numérico vindo da API ou de um campo meio preenchido não deve virar "NaN" na tela.
  return (Number.isFinite(numero) ? numero : 0).toLocaleString(LOCALE, {
    minimumFractionDigits: min,
    maximumFractionDigits: Math.max(min, max),
  });
};

/** Peso de malha com as 3 casas que o banco guarda: "58,027 kg". */
export const formatarPeso = (valor) => `${formatarNumero(valor, { min: 3, max: 3 })} kg`;

/** Peso enxuto, para KPI e texto corrido: "58,03 kg", "1.250,5 kg". */
export const formatarPesoCurto = (valor) => `${formatarNumero(valor, { min: 1, max: 2 })} kg`;

/**
 * Sigla curta da unidade de medida cadastrada no insumo.
 *
 * O backend documenta 'kg', 'unidades' e 'metros', mas o campo aceita texto livre, então
 * uma unidade desconhecida volta como veio — nunca se perde a informação. A versão antiga
 * desta função vivia só na tela de Estoque e mandava tudo que não era kg para "Uni", o que
 * fazia um insumo em metros aparecer como unidade.
 */
export const siglaUnidade = (unidade) => {
  const limpa = String(unidade || '').trim().toLowerCase();
  if (limpa === 'kg' || limpa === 'quilos' || limpa === 'quilogramas') return 'kg';
  if (limpa === 'm' || limpa === 'metro' || limpa === 'metros') return 'm';
  if (['un', 'uni', 'unid', 'unidade', 'unidades'].includes(limpa)) return 'un';
  return String(unidade || '').trim();
};

/** Quantidade de insumo na unidade cadastrada: "472,5 un", "58,027 kg", "12 m". */
export const formatarQuantidade = (valor, unidade) =>
  `${formatarNumero(valor, { max: 3 })} ${siglaUnidade(unidade)}`.trim();

/** Peças, sempre inteiras: "1.250 un." */
export const formatarPecas = (valor) =>
  `${Number(valor ?? 0).toLocaleString(LOCALE, { maximumFractionDigits: 0 })} un.`;

/**
 * Rendimento do enfesto já calculado: "5,17 peças/kg".
 * Para calcular a partir de peças e peso, use `formatarRendimento` de `utils/producao`.
 */
export const formatarPecasPorKg = (valor) => `${formatarNumero(valor, { min: 2, max: 2 })} peças/kg`;

/** Percentual: "12,3%". */
export const formatarPercentual = (valor, casas = 1) =>
  `${formatarNumero(valor, { min: casas, max: casas })}%`;

/** Valor em reais: "R$ 1.250,50". */
export const formatarMoeda = (valor) =>
  new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

/**
 * Para `<input type="number">` e corpos de requisição: ponto decimal, sem separador
 * de milhar. É o único lugar onde `toFixed` é correto.
 */
export const paraCampoNumerico = (valor, casas = 2) => Number(valor ?? 0).toFixed(casas);
