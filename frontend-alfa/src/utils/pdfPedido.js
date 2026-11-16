/** Utilitário de geração e impressão do PDF do Pedido com Grade 4×4 por Folha A4 (Fase 5). */

export const COLUNAS_GRADE_PDF = 4;
export const LINHAS_GRADE_PDF = 4;
export const QUADROS_POR_FOLHA_A4 = COLUNAS_GRADE_PDF * LINHAS_GRADE_PDF; // 16 quadros (4x4)

export const PERFIS_PDF_PEDIDO = {
  cliente: {
    id: 'cliente',
    rotulo: 'Cliente',
    descricao: 'Com valores, dados do cliente, grade 4×4 e assinatura',
    tituloDoc: 'PEDIDO COMERCIAL — VIA DO CLIENTE',
    opcoes: {
      mostrarCliente: true,
      mostrarValores: true,
      mostrarGrade4x4: true,
      mostrarTabelaItens: true,
      mostrarPrazoObservacoes: true,
      mostrarAssinatura: true,
    },
  },
  producao: {
    id: 'producao',
    rotulo: 'Produção',
    descricao: 'Sem valores financeiros; grade 4×4 + tabela de corte/separação',
    tituloDoc: 'ORDEM INTERNA DE PRODUÇÃO E SEPARAÇÃO',
    opcoes: {
      mostrarCliente: true,
      mostrarValores: false,
      mostrarGrade4x4: true,
      mostrarTabelaItens: true,
      mostrarPrazoObservacoes: true,
      mostrarAssinatura: false,
    },
  },
  estamparia: {
    id: 'estamparia',
    rotulo: 'Estamparia',
    descricao: 'Foco na folha A4 com grade 4×4 de estampas, posições e tamanhos',
    tituloDoc: 'MAPA DE ESTAMPARIA — GRADE 4×4 POR FOLHA A4',
    opcoes: {
      mostrarCliente: true,
      mostrarValores: false,
      mostrarGrade4x4: true,
      mostrarTabelaItens: false,
      mostrarPrazoObservacoes: true,
      mostrarAssinatura: false,
    },
  },
  faccao: {
    id: 'faccao',
    rotulo: 'Facção',
    descricao: 'Sem valores; tabela de montagem por modelo/cor/tamanho e conferência',
    tituloDoc: 'FICHA DE ENVIO E CONFERÊNCIA — FACÇÃO / COSTURA',
    opcoes: {
      mostrarCliente: false,
      mostrarValores: false,
      mostrarGrade4x4: false,
      mostrarTabelaItens: true,
      mostrarPrazoObservacoes: true,
      mostrarAssinatura: true,
    },
  },
};

export const OPCOES_CHECKBOX_PDF = [
  ['mostrarGrade4x4', 'Grade visual 4×4 de estampas (até 16 quadros por folha A4)'],
  ['mostrarTabelaItens', 'Tabela resumo de modelos, cores e tamanhos'],
  ['mostrarValores', 'Valores financeiros (preço unitário, subtotal e total em R$)'],
  ['mostrarCliente', 'Identificação do cliente'],
  ['mostrarPrazoObservacoes', 'Prazo de entrega e observações'],
  ['mostrarAssinatura', 'Bloco de assinatura / conferência'],
];

/** Divide os itens em páginas de até 16 quadros (4 colunas × 4 linhas por folha A4). */
export function paginarItens4x4(itens = []) {
  if (!itens.length) return [[]];
  const folhas = [];
  for (let i = 0; i < itens.length; i += QUADROS_POR_FOLHA_A4) {
    folhas.push(itens.slice(i, i + QUADROS_POR_FOLHA_A4));
  }
  return folhas;
}

const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatarMoedaPdf = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

export const formatarDataPdf = (dataIso) =>
  dataIso ? new Date(`${String(dataIso).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';

export function gerarHtmlPdfPedido(pedido, opcoes, tituloDoc = 'PEDIDO COMERCIAL') {
  const folhas = paginarItens4x4(pedido.itens || []);
  const emissao = new Date().toLocaleString('pt-BR');

  const renderQuadro = (item) => {
    const qtds = item.quantidades || [];
    const cols = Math.max(qtds.length, 1);
    const arteHtml = item.imagem_estampa_url
      ? `<img src="${escaparHtml(item.imagem_estampa_url)}" alt="${escaparHtml(item.nome_estampa || 'Estampa')}" />`
      : `<span class="quadro-lisa">Peça Lisa</span>`;
    const estampaLabel = item.id_estampa
      ? `[${escaparHtml(item.codigo_estampa)}] ${escaparHtml(item.nome_estampa)} · ${escaparHtml(item.posicao_estampa || 'Frente')}`
      : 'Sem estampa (Lisa)';
    const precoHtml = opcoes.mostrarValores && Number(item.preco_unitario) > 0
      ? `<div class="quadro-preco">${formatarMoedaPdf(item.preco_unitario)}/un · <strong>${formatarMoedaPdf(item.subtotal)}</strong></div>`
      : '';

    return `
      <div class="quadro-4x4">
        <div class="quadro-arte">${arteHtml}</div>
        <div class="quadro-meta">
          <strong>${escaparHtml(item.nome_modelo)}</strong>
          <span>
            ${item.hex_cor ? `<i class="bolinha-cor" style="background:${escaparHtml(item.hex_cor)}"></i>` : ''}
            ${escaparHtml(item.nome_cor || 'Cor a definir')}
          </span>
        </div>
        <div class="quadro-estampa">${estampaLabel}</div>
        <div class="quadro-grade-barra" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
          ${qtds.map((q) => `<span>${escaparHtml(q.rotulo)}</span>`).join('')}
        </div>
        <div class="quadro-grade-valores" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
          ${qtds.map((q) => `<strong>${q.quantidade}</strong>`).join('')}
        </div>
        <div class="quadro-rodape">
          <span>Total: <strong>${item.total} pçs</strong></span>
          ${precoHtml}
        </div>
      </div>`;
  };

  const folhasGradeHtml = opcoes.mostrarGrade4x4
    ? folhas
        .map(
          (grupo, idx) => `
      <section class="secao-grade ${idx > 0 ? 'quebra-pagina' : ''}">
        <div class="secao-titulo">
          <span>Grade Visual de Itens / Estampas (4×4 por folha A4)</span>
          <span>Folha ${idx + 1} de ${folhas.length}</span>
        </div>
        <div class="grade-4x4">
          ${grupo.map(renderQuadro).join('')}
        </div>
      </section>`,
        )
        .join('')
    : '';

  const tabelaHtml = opcoes.mostrarTabelaItens
    ? `
      <section class="secao-tabela">
        <div class="secao-titulo"><span>Resumo Consolidado de Itens</span></div>
        <table>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Cor</th>
              <th>Estampa / Posição</th>
              <th>Grade de Tamanhos</th>
              <th style="text-align:right">Peças</th>
              ${opcoes.mostrarValores ? '<th style="text-align:right">Unitário</th><th style="text-align:right">Subtotal</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${(pedido.itens || [])
              .map(
                (it) => `
              <tr>
                <td><strong>${escaparHtml(it.nome_modelo)}</strong></td>
                <td>${escaparHtml(it.nome_cor || 'A definir')}</td>
                <td>${
                  it.id_estampa
                    ? `[${escaparHtml(it.codigo_estampa)}] ${escaparHtml(it.nome_estampa)} (${escaparHtml(it.posicao_estampa || 'Frente')})`
                    : 'Lisa'
                }</td>
                <td>${(it.quantidades || []).map((q) => `${escaparHtml(q.rotulo)}: <strong>${q.quantidade}</strong>`).join(' · ')}</td>
                <td style="text-align:right"><strong>${it.total}</strong></td>
                ${
                  opcoes.mostrarValores
                    ? `<td style="text-align:right">${formatarMoedaPdf(it.preco_unitario)}</td><td style="text-align:right"><strong>${formatarMoedaPdf(it.subtotal)}</strong></td>`
                    : ''
                }
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escaparHtml(pedido.codigo_pedido)} — ${escaparHtml(tituloDoc)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2c2523; margin: 0; padding: 10px; font-size: 11px; }
    .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2c2523; padding-bottom: 8px; margin-bottom: 10px; }
    .cabecalho h1 { margin: 0; font-size: 16px; }
    .cabecalho small { color: #6b7280; display: block; margin-top: 2px; }
    .resumo-barra { display: flex; flex-wrap: wrap; gap: 12px; background: #f5f2ea; border: 1px solid #d8d1c5; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; }
    .resumo-barra div span { display: block; font-size: 9px; text-transform: uppercase; color: #6b7280; }
    .resumo-barra div strong { font-size: 12px; }
    .secao-titulo { display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; text-transform: uppercase; margin: 8px 0 6px; color: #44403c; }
    .quebra-pagina { page-break-before: always; }
    .grade-4x4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .quadro-4x4 { border: 1px solid #d8d1c5; border-radius: 10px; background: #f5f2ea; padding: 6px; display: flex; flex-direction: column; gap: 4px; page-break-inside: avoid; }
    .quadro-arte { height: 96px; border: 1px dashed #8a8175; border-radius: 7px; background: #faf8f3; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 4px; }
    .quadro-arte img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .quadro-lisa { font-size: 10px; color: #78716c; font-weight: 600; }
    .quadro-meta { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 9.5px; }
    .bolinha-cor { display: inline-block; width: 8px; height: 8px; border-radius: 99px; border: 1px solid rgba(0,0,0,0.25); vertical-align: middle; }
    .quadro-estampa { font-size: 8.8px; color: #57534e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .quadro-grade-barra { display: grid; background: #dfd7c8; border-radius: 5px; padding: 2px; text-align: center; font-weight: 700; font-size: 9px; }
    .quadro-grade-valores { display: grid; gap: 3px; text-align: center; }
    .quadro-grade-valores strong { background: #ffffff; border: 1px solid #d5cec0; border-radius: 5px; padding: 2px 0; font-size: 10px; }
    .quadro-rodape { display: flex; justify-content: space-between; align-items: center; font-size: 8.8px; padding-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    th { background: #eee8dc; text-align: left; padding: 5px 6px; border-bottom: 1px solid #c7bfb1; }
    td { padding: 5px 6px; border-bottom: 1px solid #e5dec9; }
    .assinatura-box { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; page-break-inside: avoid; }
    .assinatura-linha { border-top: 1px solid #2c2523; padding-top: 4px; text-align: center; font-size: 10px; }
  </style>
</head>
<body>
  <header class="cabecalho">
    <div>
      <h1>CONFECÇÃO ALFA · ${escaparHtml(tituloDoc)}</h1>
      <small>Pedido ${escaparHtml(pedido.codigo_pedido)} · Emitido em ${escaparHtml(emissao)}</small>
    </div>
    <div style="text-align:right">
      <strong>Total: ${pedido.quantidade_total} peças</strong>
      ${opcoes.mostrarValores ? `<small style="font-size:12px;color:#047857;font-weight:700">${formatarMoedaPdf(pedido.valor_total)}</small>` : ''}
    </div>
  </header>

  <section class="resumo-barra">
    ${opcoes.mostrarCliente ? `<div><span>Cliente</span><strong>${escaparHtml(pedido.nome_cliente)}</strong></div>` : ''}
    ${opcoes.mostrarPrazoObservacoes ? `<div><span>Prazo de Entrega</span><strong>${formatarDataPdf(pedido.prazo_entrega)}</strong></div>` : ''}
    <div><span>Status</span><strong>${escaparHtml(pedido.status_pedido)}</strong></div>
    ${opcoes.mostrarPrazoObservacoes && pedido.observacoes ? `<div style="flex:1"><span>Observações</span><strong>${escaparHtml(pedido.observacoes)}</strong></div>` : ''}
  </section>

  ${folhasGradeHtml}
  ${tabelaHtml}

  ${
    opcoes.mostrarAssinatura
      ? `<div class="assinatura-box">
          <div class="assinatura-linha">Responsável Confecção Alfa</div>
          <div class="assinatura-linha">${opcoes.mostrarCliente ? escaparHtml(pedido.nome_cliente) : 'Responsável Conferência / Recebimento'}</div>
        </div>`
      : ''
  }
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`;
}

export function imprimirPdfPedido(pedido, opcoes, tituloDoc, onPopUpBloqueado) {
  const janela = window.open('', '_blank');
  if (!janela) {
    if (onPopUpBloqueado) onPopUpBloqueado();
    return false;
  }
  janela.document.write(gerarHtmlPdfPedido(pedido, opcoes, tituloDoc));
  janela.document.close();
  return true;
}
