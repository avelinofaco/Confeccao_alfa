import { chaveCelula } from './grade';

const colunasDe = (tamanhos) => tamanhos.map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));
const celulasDa = (linha) => linha.tamanhos.map((t) => ({ ...t, id_cor: linha.id_cor, chave: chaveCelula(linha.id_cor, t.id_tamanho) }));

/** Agrupa as linhas da API (uma por modelo × cor) em cartões por modelo, mantendo a ordem. */
export function agruparPorModelo(linhas) {
  return linhas.reduce((grupos, linha) => {
    const linhaGrade = { id: linha.id_cor, rotulo: linha.nome_cor, hex: linha.hex_cor };
    const existente = grupos.find((g) => g.id_modelo === linha.id_modelo);
    if (!existente) {
      return [...grupos, {
        id_modelo: linha.id_modelo, nome_modelo: linha.nome_modelo, colunas: colunasDe(linha.tamanhos),
        linhas: [linhaGrade], celulas: celulasDa(linha),
      }];
    }
    return grupos.map((g) => (g === existente
      ? { ...g, linhas: [...g.linhas, linhaGrade], celulas: [...g.celulas, ...celulasDa(linha)] }
      : g));
  }, []);
}

export const valoresDoGrupo = (grupo) => Object.fromEntries(grupo.celulas.map((c) => [c.chave, c.saldo]));
export const alertasDoGrupo = (grupo) => Object.fromEntries(grupo.celulas.map((c) => [c.chave, c.abaixo_minimo]));
export const celulaDoGrupo = (grupo, idCor, idTamanho) => grupo.celulas.find((c) => c.chave === chaveCelula(idCor, idTamanho));

/** Valores iniciais da contagem: o saldo atual de cada célula, separados por modelo. */
export const valoresIniciaisInventario = (grupos) => Object.fromEntries(grupos.map((g) => [g.id_modelo, valoresDoGrupo(g)]));

/** Inclui no inventário uma cor de um modelo (mesmo sem estoque ainda). */
export function acrescentarLinha(grupos, modelo, cor) {
  const linha = { id: cor.id_cor, rotulo: cor.nome, hex: cor.hex };
  const existente = grupos.find((g) => g.id_modelo === modelo.id_modelo);
  if (existente?.linhas.some((l) => l.id === cor.id_cor)) return grupos;
  if (existente) return grupos.map((g) => (g === existente ? { ...g, linhas: [...g.linhas, linha] } : g));
  return [...grupos, {
    id_modelo: modelo.id_modelo, nome_modelo: modelo.nome_modelo,
    colunas: colunasDe(modelo.grade_tamanhos || []), linhas: [linha], celulas: [],
  }];
}

/** Contagens para a API: só as células preenchidas (em branco = não contado). */
export function contagensDoInventario(grupos, valoresPorModelo) {
  return grupos.flatMap((grupo) => grupo.linhas.flatMap((linha) => grupo.colunas
    .map((coluna) => ({ coluna, texto: valoresPorModelo[grupo.id_modelo]?.[chaveCelula(linha.id, coluna.id)] }))
    .filter(({ texto }) => texto !== undefined && texto !== '')
    .map(({ coluna, texto }) => ({
      id_modelo: grupo.id_modelo, id_cor: linha.id, id_tamanho: coluna.id, quantidade_contada: Number(texto) || 0,
    }))));
}
