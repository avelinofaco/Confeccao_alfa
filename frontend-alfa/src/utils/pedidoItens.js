import { chaveCelula } from './grade';

export const LINHA_QTD = 'qtd';

export const POSICOES_ESTAMPA = [
  'Frente',
  'Costas',
  'Peito Esquerdo',
  'Peito Direito',
  'Manga Esquerda',
  'Manga Direita',
  'Nuca',
  'Frente e Costas',
];

/** Item vazio do editor; `chave` só identifica o item na tela. */
export const itemVazio = (chave, idModelo = '') => ({
  chave,
  id_modelo: String(idModelo),
  id_cor: '',
  id_estampa: '',
  posicao_estampa: 'Frente',
  valores: {},
});

export const colunasDoModelo = (modelo) => (modelo?.grade_tamanhos || []).map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));

export const totalDoItem = (item) => Object.values(item.valores).reduce((total, valor) => total + (Number(valor) || 0), 0);

export const itemParaApi = (item) => ({
  id_modelo: Number(item.id_modelo),
  id_cor: item.id_cor ? Number(item.id_cor) : null,
  id_estampa: item.id_estampa ? Number(item.id_estampa) : null,
  posicao_estampa: item.id_estampa ? (item.posicao_estampa || 'Frente') : null,
  quantidades: Object.entries(item.valores)
    .map(([chave, valor]) => ({ id_tamanho: Number(chave.split(':')[1]), quantidade: Number(valor) || 0 }))
    .filter((q) => q.quantidade > 0),
});

export const itemDaApi = (item, chave) => ({
  chave,
  id_modelo: String(item.id_modelo),
  id_cor: item.id_cor ? String(item.id_cor) : '',
  id_estampa: item.id_estampa ? String(item.id_estampa) : '',
  posicao_estampa: item.posicao_estampa || 'Frente',
  valores: Object.fromEntries(item.quantidades.map((q) => [chaveCelula(LINHA_QTD, q.id_tamanho), q.quantidade])),
});

/** Primeiro problema que impede salvar os itens, ou '' quando está tudo certo. */
export function problemaDosItens(itens) {
  if (itens.length === 0) return 'Inclua pelo menos um item no pedido.';
  const semModelo = itens.findIndex((i) => !i.id_modelo);
  if (semModelo >= 0) return `Escolha o modelo do item ${semModelo + 1}.`;
  const semCor = itens.findIndex((i) => !i.id_cor);
  if (semCor >= 0) return `Escolha a cor do item ${semCor + 1}.`;
  const vazio = itens.findIndex((i) => totalDoItem(i) <= 0);
  if (vazio >= 0) return `Informe as quantidades do item ${vazio + 1}.`;
  const chaves = itens.map(
    (i) => `${i.id_modelo}:${i.id_cor}:${i.id_estampa || ''}:${i.id_estampa ? (i.posicao_estampa || 'Frente').toLowerCase() : ''}`,
  );
  const repetido = chaves.findIndex((chave, indice) => chaves.indexOf(chave) !== indice);
  if (repetido >= 0) return `O item ${repetido + 1} repete modelo, cor e estampa de outro item; junte as quantidades num item só.`;
  return '';
}

/** "Camiseta Básica · Preto · [EST-001 Leão — Frente]: P10 M20" (sem cor: "cor não informada"). */
export const resumoDoItem = (item) => {
  const estampaTxt = item.id_estampa
    ? ` · [${item.codigo_estampa} ${item.nome_estampa} — ${item.posicao_estampa || 'Frente'}]`
    : '';
  const qtdsTxt = item.quantidades.map((q) => `${q.rotulo}${q.quantidade}`).join(' ');
  return `${item.nome_modelo} · ${item.nome_cor || 'cor não informada'}${estampaTxt}: ${qtdsTxt}`;
};

const chaveSku = (idModelo, idCor, idTamanho) => `${idModelo}:${idCor}:${idTamanho}`;

/** Saldo de cada SKU a partir da listagem de Produtos Prontos. */
export const saldosDosProdutos = (linhas) => new Map(
  linhas.flatMap((linha) => linha.tamanhos.map((t) => [chaveSku(linha.id_modelo, linha.id_cor, t.id_tamanho), t.saldo])),
);

/** Conferência da entrega consolidada por SKU: necessário × disponível de cada SKU do pedido. */
export const linhasDaEntrega = (pedido, saldos) => {
  const agrupado = new Map();
  for (const item of pedido.itens) {
    for (const q of item.quantidades) {
      const chave = `${item.id_modelo}:${item.id_cor || 'sem-cor'}:${q.id_tamanho}`;
      const existente = agrupado.get(chave);
      if (!existente) {
        agrupado.set(chave, {
          chave,
          sku: `${item.nome_modelo} · ${item.nome_cor || 'cor não informada'} · ${q.rotulo}`,
          necessario: q.quantidade,
          disponivel: item.id_cor ? saldos.get(chaveSku(item.id_modelo, item.id_cor, q.id_tamanho)) ?? 0 : 0,
          semCor: !item.id_cor,
        });
      } else {
        existente.necessario += q.quantidade;
      }
    }
  }
  return Array.from(agrupado.values());
};
