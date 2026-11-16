import { useState } from 'react';
import { Printer } from 'lucide-react';
import { ModalProducao } from '../producao/ModalProducao';
import { useToast } from '../feedback/useToast';
import {
  OPCOES_CHECKBOX_PDF,
  PERFIS_PDF_PEDIDO,
  formatarDataPdf,
  formatarMoedaPdf,
  imprimirPdfPedido,
  paginarItens4x4,
} from '../../utils/pdfPedido';
import '../cadastros/cadastros.css';
import './pedidos.css';

/**
 * Modal de exportação de PDF do pedido com:
 * - 4 perfis rápidos (Cliente, Produção, Estamparia, Facção)
 * - Checkboxes personalizáveis do que exibir no PDF
 * - Prévia ao vivo da Folha A4 com a Grade 4×4 (até 16 quadros por folha A4)
 */
export function ModalPdfPedido({ pedido, onFechar }) {
  const toast = useToast();
  const [perfilAtivo, setPerfilAtivo] = useState('cliente');
  const [opcoes, setOpcoes] = useState(() => ({ ...PERFIS_PDF_PEDIDO.cliente.opcoes }));

  const selecionarPerfil = (idPerfil) => {
    const perfil = PERFIS_PDF_PEDIDO[idPerfil];
    if (!perfil) return;
    setPerfilAtivo(idPerfil);
    setOpcoes({ ...perfil.opcoes });
  };

  const alternarOpcao = (chave) => {
    setOpcoes((atual) => ({ ...atual, [chave]: !atual[chave] }));
  };

  const tituloDoc = PERFIS_PDF_PEDIDO[perfilAtivo]?.tituloDoc || 'PEDIDO COMERCIAL';
  const folhas = paginarItens4x4(pedido.itens || []);

  const handleImprimir = () => {
    imprimirPdfPedido(pedido, opcoes, tituloDoc, () => {
      toast.aviso('Permita janelas pop-up neste navegador para exportar o PDF do pedido.');
    });
  };

  return (
    <ModalProducao
      titulo={`Exportar PDF — Pedido ${pedido.codigo_pedido}`}
      idTitulo="titulo-modal-pdf-pedido"
      onFechar={onFechar}
      largo
    >
      <div className="pdf-pedido-config">
        <div className="pdf-pedido-perfis" role="tablist" aria-label="Modelo de destinatário do PDF">
          {Object.values(PERFIS_PDF_PEDIDO).map((perfil) => (
            <button
              key={perfil.id}
              type="button"
              role="tab"
              aria-selected={perfilAtivo === perfil.id}
              className={`pdf-perfil-btn ${perfilAtivo === perfil.id ? 'ativo' : ''}`}
              onClick={() => selecionarPerfil(perfil.id)}
            >
              <strong>{perfil.rotulo}</strong>
              <small>{perfil.descricao}</small>
            </button>
          ))}
        </div>

        <fieldset className="pdf-pedido-checkboxes">
          <legend>O que deve aparecer no PDF:</legend>
          <div className="pdf-checkboxes-grid">
            {OPCOES_CHECKBOX_PDF.map(([chave, rotulo]) => (
              <label key={chave} className="cadastro-campo cadastro-campo-check" htmlFor={`pdf-chk-${chave}`}>
                <input
                  id={`pdf-chk-${chave}`}
                  type="checkbox"
                  checked={!!opcoes[chave]}
                  onChange={() => alternarOpcao(chave)}
                />
                <span>{rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Pré-visualização ao vivo da Folha A4 com a Grade 4×4 */}
      <div className="pdf-previa-folha-a4" aria-label="Pré-visualização do documento A4">
        <header className="pdf-previa-cabecalho">
          <div>
            <h3>CONFECÇÃO ALFA · {tituloDoc}</h3>
            <small>Pedido {pedido.codigo_pedido}</small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Total: {pedido.quantidade_total} peças</strong>
            {opcoes.mostrarValores && (
              <div style={{ color: '#047857', fontWeight: 700 }}>{formatarMoedaPdf(pedido.valor_total)}</div>
            )}
          </div>
        </header>

        <div className="pdf-previa-metadados">
          {opcoes.mostrarCliente && (
            <span>
              <strong>Cliente:</strong> {pedido.nome_cliente}
            </span>
          )}
          {opcoes.mostrarPrazoObservacoes && (
            <span>
              <strong>Prazo:</strong> {formatarDataPdf(pedido.prazo_entrega)}
            </span>
          )}
          <span>
            <strong>Status:</strong> {pedido.status_pedido}
          </span>
        </div>

        {opcoes.mostrarGrade4x4 &&
          folhas.map((grupo, idxFolha) => (
            <div key={idxFolha} className="pdf-previa-secao-grade">
              <div className="pdf-previa-secao-titulo">
                <span>Grade de Estampas 4×4 (até 16 quadros por folha A4)</span>
                <span>
                  Folha {idxFolha + 1} de {folhas.length}
                </span>
              </div>
              <div className="pdf-grade-4x4">
                {grupo.map((item, idxItem) => {
                  const qtds = item.quantidades || [];
                  const cols = Math.max(qtds.length, 1);
                  return (
                    <div key={item.id_item || idxItem} className="pdf-quadro-4x4">
                      <div className="pdf-quadro-arte">
                        {item.imagem_estampa_url ? (
                          <img src={item.imagem_estampa_url} alt={item.nome_estampa || 'Estampa'} />
                        ) : (
                          <span className="pdf-quadro-lisa">Peça Lisa</span>
                        )}
                      </div>
                      <div className="pdf-quadro-meta">
                        <strong>{item.nome_modelo}</strong>
                        <span>
                          {item.hex_cor && (
                            <i
                              className="item-pedido-cor-bolinha"
                              style={{ background: item.hex_cor, display: 'inline-block', marginRight: 3 }}
                            />
                          )}
                          {item.nome_cor || 'Cor a definir'}
                        </span>
                      </div>
                      <div className="pdf-quadro-estampa">
                        {item.id_estampa
                          ? `[${item.codigo_estampa}] ${item.nome_estampa} · ${item.posicao_estampa || 'Frente'}`
                          : 'Sem estampa (Lisa)'}
                      </div>
                      <div
                        className="item-pedido-tamanhos-barra"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, padding: '0.2rem 0.1rem', fontSize: '0.7rem' }}
                      >
                        {qtds.map((q) => (
                          <span key={q.id_tamanho}>{q.rotulo}</span>
                        ))}
                      </div>
                      <div
                        className="pdf-quadro-qtds"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                      >
                        {qtds.map((q) => (
                          <strong key={q.id_tamanho}>{q.quantidade}</strong>
                        ))}
                      </div>
                      <div className="item-pedido-preco-rodape">
                        <span>{item.total} pçs</span>
                        {opcoes.mostrarValores && Number(item.preco_unitario) > 0 && (
                          <strong>{formatarMoedaPdf(item.subtotal)}</strong>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        {opcoes.mostrarTabelaItens && (
          <div className="pdf-previa-tabela-box">
            <div className="pdf-previa-secao-titulo">
              <span>Tabela Resumo de Itens</span>
            </div>
            <table className="entrega-skus">
              <thead>
                <tr>
                  <th>Modelo / Cor</th>
                  <th>Estampa</th>
                  <th>Tamanhos</th>
                  <th>Peças</th>
                  {opcoes.mostrarValores && <th>Subtotal</th>}
                </tr>
              </thead>
              <tbody>
                {(pedido.itens || []).map((it, idx) => (
                  <tr key={it.id_item || idx}>
                    <td>
                      {it.nome_modelo} · {it.nome_cor || 'A definir'}
                    </td>
                    <td>
                      {it.id_estampa ? `[${it.codigo_estampa}] ${it.nome_estampa} (${it.posicao_estampa || 'Frente'})` : 'Lisa'}
                    </td>
                    <td>{(it.quantidades || []).map((q) => `${q.rotulo}:${q.quantidade}`).join(' ')}</td>
                    <td>
                      <strong>{it.total}</strong>
                    </td>
                    {opcoes.mostrarValores && (
                      <td>
                        <strong>{formatarMoedaPdf(it.subtotal)}</strong>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="cadastro-modal-rodape">
        <button type="button" className="cadastro-btn secundario" onClick={onFechar}>
          Fechar
        </button>
        <button type="button" className="cadastro-btn primario" onClick={handleImprimir}>
          <Printer size={16} aria-hidden="true" /> Imprimir / Salvar PDF
        </button>
      </footer>
    </ModalProducao>
  );
}
