import { chaveCelula } from './grade';

export const LINHA_QTD = 'qtd';

/** Item vazio do editor; `chave` só identifica o item na tela. */
export const itemVazio = (chave, idModelo = '') => ({ chave, id_modelo: String(idModelo), id_cor: '', valores: {} });

export const colunasDoModelo = (modelo) => (modelo?.grade_tamanhos || []).map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));

export const totalDoItem = (item) => Object.values(item.valores).reduce((total, valor) => total + (Number(valor) || 0), 0);

export const itemParaApi = (item) => ({
  id_modelo: Number(item.id_modelo),
  id_cor: item.id_cor ? Number(item.id_cor) : null,
  quantidades: Object.entries(item.valores)
    .map(([chave, valor]) => ({ id_tamanho: Number(chave.split(':')[1]), quantidade: Number(valor) || 0 }))
    .filter((q) => q.quantidade > 0),
});

export const itemDaApi = (item, chave) => ({
  chave,
  id_modelo: String(item.id_modelo),
  id_cor: item.id_cor ? String(item.id_cor) : '',
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
  const chaves = itens.map((i) => `${i.id_modelo}:${i.id_cor}`);
  const repetido = chaves.findIndex((chave, indice) => chaves.indexOf(chave) !== indice);
  if (repetido >= 0) return `O item ${repetido + 1} repete modelo e cor de outro item; junte as quantidades num item só.`;
  return '';
}

/** "Camiseta Básica · Preto: P10 M20" (sem cor: "cor não informada"). */
export const resumoDoItem = (item) =>
  `${item.nome_modelo} · ${item.nome_cor || 'cor não informada'}: ${item.quantidades.map((q) => `${q.rotulo}${q.quantidade}`).join(' ')}`;

const chaveSku = (idModelo, idCor, idTamanho) => `${idModelo}:${idCor}:${idTamanho}`;

/** Saldo de cada SKU a partir da listagem de Produtos Prontos. */
export const saldosDosProdutos = (linhas) => new Map(
  linhas.flatMap((linha) => linha.tamanhos.map((t) => [chaveSku(linha.id_modelo, linha.id_cor, t.id_tamanho), t.saldo])),
);

/** Conferência da entrega: necessário × disponível de cada SKU do pedido. */
export const linhasDaEntrega = (pedido, saldos) => pedido.itens.flatMap((item) => item.quantidades.map((q) => ({
  chave: `${item.id_item}-${q.id_tamanho}`,
  sku: `${item.nome_modelo} · ${item.nome_cor || 'cor não informada'} · ${q.rotulo}`,
  necessario: q.quantidade,
  disponivel: item.id_cor ? saldos.get(chaveSku(item.id_modelo, item.id_cor, q.id_tamanho)) ?? 0 : 0,
  semCor: !item.id_cor,
})));
